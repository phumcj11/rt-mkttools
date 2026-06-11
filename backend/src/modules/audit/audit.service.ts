import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities';

export interface AuditEntry {
  tenantId: number | null;
  userId?: number | null;
  action: string;
  entity?: string | null;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * บันทึก audit log — ออกแบบให้ไม่ throw เพื่อไม่ให้ flow หลักล้มเพราะ logging
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          tenantId: entry.tenantId ?? null,
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity ?? null,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata ?? null,
          ipAddress: entry.ipAddress ?? null,
        }),
      );
    } catch (err) {
      this.logger.warn(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  async list(tenantId: number, limit = 100, action?: string) {
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .orderBy('a.created_at', 'DESC')
      .limit(Math.min(limit, 500));
    if (action) {
      qb.andWhere('a.action = :action', { action });
    }
    return qb.getMany();
  }
}
