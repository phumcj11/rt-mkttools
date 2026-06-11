import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import {
  ConflictAppException,
  UnauthorizedAppException,
} from '../../common/exceptions/app.exception';
import { JwtConfig } from '../../config/configuration';
import { PasswordReset, RefreshToken, Role, RoleName, Tenant, User } from '../../database/entities';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { JwtPayload } from '../../common/interfaces/auth-user.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const DEFAULT_ROLES: { name: RoleName; description: string }[] = [
  { name: 'owner', description: 'เจ้าของร้าน — สิทธิ์เต็ม' },
  { name: 'admin', description: 'ผู้ดูแลระบบของร้าน' },
  { name: 'editor', description: 'สร้าง/แก้ไขคอนเทนต์และแคมเปญ' },
  { name: 'viewer', description: 'ดูข้อมูลอย่างเดียว' },
];

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(RefreshToken) private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(PasswordReset) private readonly passwordResetRepo: Repository<PasswordReset>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly billingService: BillingService,
    private readonly audit: AuditService,
  ) {
    this.jwtConfig = this.config.getOrThrow<JwtConfig>('jwt');
  }

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictAppException('auth.emailTaken');
    }

    const defaultLocale = this.config.get<string>('app.defaultLocale') ?? 'th';
    const slug = await this.generateUniqueSlug(dto.shopName);

    const tenant = await this.tenantRepo.save(
      this.tenantRepo.create({
        name: dto.shopName,
        slug,
        status: 'trial',
        locale: defaultLocale,
      }),
    );

    await this.billingService.createDefaultSubscription(tenant.id);

    const ownerRole = await this.getOrCreateRole('owner');
    const passwordHash = await bcrypt.hash(dto.password, this.jwtConfig.bcryptSaltRounds);

    const user = await this.userRepo.save(
      this.userRepo.create({
        tenantId: tenant.id,
        email: dto.email,
        passwordHash,
        fullName: dto.fullName ?? null,
        locale: defaultLocale,
        status: 'active',
        roles: [ownerRole],
      }),
    );

    await this.audit.log({
      tenantId: tenant.id,
      userId: user.id,
      action: 'auth.registered',
      entity: 'user',
      entityId: user.id,
      metadata: { email: user.email },
    });

    return this.buildAuthResponse(user, tenant);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .leftJoinAndSelect('u.roles', 'r')
      .leftJoinAndSelect('u.tenant', 't')
      .where('u.email = :email', { email: dto.email })
      .getOne();

    if (!user || user.status === 'disabled') {
      throw new UnauthorizedAppException('auth.invalidCredentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedAppException('auth.invalidCredentials');
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
    });
    return this.buildAuthResponse(user, user.tenant);
  }

  async refresh(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.refreshRepo.findOne({ where: { tokenHash } });

    if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedAppException('auth.unauthorized');
    }

    const user = await this.userRepo.findOne({
      where: { id: record.userId },
      relations: { roles: true, tenant: true },
    });
    if (!user || user.status === 'disabled') {
      throw new UnauthorizedAppException('auth.unauthorized');
    }

    // rotate: เพิกถอนตัวเก่าแล้วออกใหม่
    await this.refreshRepo.update(record.id, { revokedAt: new Date() });
    return this.buildAuthResponse(user, user.tenant);
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.refreshRepo.update({ tokenHash }, { revokedAt: new Date() });
  }

  async requestPasswordReset(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    const response: { message: string; resetUrl?: string } = {
      message: 'auth.passwordResetRequested',
    };

    if (!user || user.status === 'disabled') {
      return response;
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.passwordResetRepo
      .createQueryBuilder()
      .update(PasswordReset)
      .set({ usedAt: new Date() })
      .where('user_id = :userId AND used_at IS NULL', { userId: user.id })
      .execute();

    await this.passwordResetRepo.save(
      this.passwordResetRepo.create({
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt,
      }),
    );

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'auth.password_reset_requested',
      entity: 'user',
      entityId: user.id,
    });

    if (!process.env.SMTP_HOST) {
      response.resetUrl = this.buildResetUrl(rawToken, user.locale);
    }

    return response;
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.passwordResetRepo.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedAppException('auth.invalidResetToken');
    }

    const user = record.user;
    if (!user || user.status === 'disabled') {
      throw new UnauthorizedAppException('auth.invalidResetToken');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.jwtConfig.bcryptSaltRounds);
    await this.userRepo.update(user.id, { passwordHash });
    await this.passwordResetRepo.update(record.id, { usedAt: new Date() });
    await this.refreshRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId AND revoked_at IS NULL', { userId: user.id })
      .execute();

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'auth.password_reset_completed',
      entity: 'user',
      entityId: user.id,
    });

    return { message: 'auth.passwordResetCompleted' };
  }

  // ---------- helpers ----------

  private async buildAuthResponse(user: User, tenant: Tenant) {
    const roles: RoleName[] = (user.roles ?? []).map((r) => r.name);
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      locale: user.locale,
    };

    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        locale: user.locale,
        tenantId: user.tenantId,
        roles,
      },
      tenant: tenant
        ? { id: tenant.id, name: tenant.name, slug: tenant.slug, locale: tenant.locale }
        : null,
      tokens: {
        tokenType: 'Bearer',
        accessToken,
        refreshToken,
        expiresIn: this.jwtConfig.accessExpiresIn,
      },
    };
  }

  private async issueRefreshToken(userId: number): Promise<string> {
    const rawToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + this.parseDurationMs(this.jwtConfig.refreshExpiresIn));

    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId,
        tokenHash: this.hashToken(rawToken),
        expiresAt,
      }),
    );
    return rawToken;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildResetUrl(rawToken: string, locale: string): string {
    const corsOrigins = this.config.get<string[]>('app.corsOrigins') ?? [];
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.FRONTEND_PUBLIC_URL ??
      corsOrigins[0] ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const safeLocale = locale === 'en' ? 'en' : 'th';
    return `${baseUrl}/${safeLocale}/reset-password?token=${encodeURIComponent(rawToken)}`;
  }

  private async getOrCreateRole(name: RoleName): Promise<Role> {
    let role = await this.roleRepo.findOne({ where: { name } });
    if (!role) {
      // กรณียังไม่ได้ seed — สร้าง role พื้นฐานให้อัตโนมัติ
      await this.roleRepo.save(DEFAULT_ROLES.map((r) => this.roleRepo.create(r)));
      role = await this.roleRepo.findOne({ where: { name } });
    }
    return role as Role;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100) || 'shop';

    let slug = `${base}-${randomBytes(3).toString('hex')}`;
    while (await this.tenantRepo.exists({ where: { slug } })) {
      slug = `${base}-${randomBytes(4).toString('hex')}`;
    }
    return slug;
  }

  private parseDurationMs(value: string): number {
    const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(value.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = parseInt(match[1], 10);
    const unit = match[2] ?? 's';
    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * (multipliers[unit] ?? 1000);
  }
}
