import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Notification, NotificationType } from '../../database/entities';
import { RealtimeService } from '../realtime/realtime.service';

export interface CreateNotificationParams {
  tenantId: number;
  userId?: number | null;
  type?: NotificationType;
  title: string;
  body?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * สร้าง notification + ส่ง realtime ทันที
   * ถ้าระบุ userId จะส่งเฉพาะ user นั้น มิฉะนั้นส่งทั้ง tenant
   */
  async create(params: CreateNotificationParams): Promise<Notification> {
    const notif = await this.notifRepo.save(
      this.notifRepo.create({
        tenantId: params.tenantId,
        userId: params.userId ?? null,
        type: params.type ?? 'system',
        title: params.title,
        body: params.body ?? null,
        isRead: false,
      }),
    );

    if (params.userId) {
      this.realtime.emitToUser(params.userId, 'notification:new', notif);
    } else {
      this.realtime.emitToTenant(params.tenantId, 'notification:new', notif);
    }

    return notif;
  }

  list(tenantId: number, userId: number) {
    return this.scopedQuery(tenantId, userId)
      .orderBy('n.created_at', 'DESC')
      .limit(50)
      .getMany();
  }

  async unreadCount(tenantId: number, userId: number): Promise<{ count: number }> {
    const count = await this.scopedQuery(tenantId, userId)
      .andWhere('n.is_read = :read', { read: 0 })
      .getCount();
    return { count };
  }

  async markRead(tenantId: number, userId: number, id: number): Promise<{ id: number }> {
    await this.notifRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('id = :id', { id })
      .andWhere('tenant_id = :tenantId', { tenantId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('user_id = :userId', { userId }).orWhere('user_id IS NULL');
        }),
      )
      .execute();
    return { id };
  }

  async markAllRead(tenantId: number, userId: number): Promise<{ count: number }> {
    const result = await this.notifRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('user_id = :userId', { userId }).orWhere('user_id IS NULL');
        }),
      )
      .andWhere('is_read = 0')
      .execute();
    return { count: result.affected ?? 0 };
  }

  private scopedQuery(tenantId: number, userId: number) {
    return this.notifRepo
      .createQueryBuilder('n')
      .where('n.tenant_id = :tenantId', { tenantId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('n.user_id = :userId', { userId }).orWhere('n.user_id IS NULL');
        }),
      );
  }
}
