import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, Repository } from 'typeorm';
import {
  ConflictAppException,
  NotFoundAppException,
} from '../../common/exceptions/app.exception';
import { Role, RoleName, User } from '../../database/entities';
import { BillingService } from '../billing/billing.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    private readonly config: ConfigService,
    private readonly billingService: BillingService,
  ) {}

  async findAll(tenantId: number) {
    const users = await this.userRepo.find({
      where: { tenantId },
      relations: { roles: true },
      order: { createdAt: 'DESC' },
    });
    return users.map((u) => this.serialize(u));
  }

  async findOne(tenantId: number, id: number) {
    const user = await this.getOwned(tenantId, id);
    return this.serialize(user);
  }

  async create(tenantId: number, dto: CreateUserDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictAppException('auth.emailTaken');
    }

    await this.billingService.assertUserLimit(tenantId);

    const saltRounds = this.config.get<number>('jwt.bcryptSaltRounds') ?? 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);
    const roles = await this.resolveRoles(dto.roles);
    const defaultLocale = this.config.get<string>('app.defaultLocale') ?? 'th';

    const user = await this.userRepo.save(
      this.userRepo.create({
        tenantId,
        email: dto.email,
        passwordHash,
        fullName: dto.fullName ?? null,
        locale: defaultLocale,
        status: 'active',
        roles,
        branchId: dto.branchId ?? null,
      }),
    );
    return this.serialize(user);
  }

  async update(tenantId: number, id: number, dto: UpdateUserDto) {
    const user = await this.getOwned(tenantId, id);

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.locale !== undefined) user.locale = dto.locale;
    if (dto.status !== undefined) user.status = dto.status;
    if (dto.roles !== undefined) user.roles = await this.resolveRoles(dto.roles);
    if (dto.branchId !== undefined) user.branchId = dto.branchId;

    const saved = await this.userRepo.save(user);
    return this.serialize(saved);
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const user = await this.getOwned(tenantId, id);
    await this.userRepo.remove(user);
  }

  // ---------- helpers ----------

  private async getOwned(tenantId: number, id: number): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id, tenantId },
      relations: { roles: true },
    });
    if (!user) {
      throw new NotFoundAppException();
    }
    return user;
  }

  private async resolveRoles(names: RoleName[]): Promise<Role[]> {
    const unique = Array.from(new Set(names));
    const roles = await this.roleRepo.find({ where: { name: In(unique) } });
    return roles;
  }

  private serialize(user: User) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      locale: user.locale,
      status: user.status,
      roles: (user.roles ?? []).map((r) => r.name),
      branchId: user.branchId,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
