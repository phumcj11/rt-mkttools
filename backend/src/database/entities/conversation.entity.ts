import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ConversationStatus = 'open' | 'resolved' | 'pending';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_conv_tenant')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ type: 'varchar', length: 50 })
  channel: string;

  @Column({ name: 'channel_config_id', type: 'bigint', unsigned: true, nullable: true })
  channelConfigId: number | null;

  @Column({ name: 'external_id', type: 'varchar', length: 512 })
  externalId: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName: string | null;

  @Column({ name: 'customer_handle', type: 'varchar', length: 255, nullable: true })
  customerHandle: string | null;

  @Column({ type: 'enum', enum: ['open', 'resolved', 'pending'], default: 'open' })
  status: ConversationStatus;

  @Column({ name: 'assigned_user_id', type: 'bigint', unsigned: true, nullable: true })
  assignedUserId: number | null;

  @Column({ name: 'last_message_at', type: 'timestamp', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'unread_count', type: 'int', unsigned: true, default: 0 })
  unreadCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
