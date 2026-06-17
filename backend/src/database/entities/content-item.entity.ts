import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
export type ContentStatus = 'draft' | 'approved' | 'scheduled' | 'published';

@Entity('content_items')
export class ContentItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_content_tenant')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Index('idx_content_campaign')
  @Column({ name: 'campaign_id', type: 'bigint', unsigned: true, nullable: true })
  campaignId: number | null;

  @Index('idx_content_sku')
  @Column({ type: 'varchar', length: 100, nullable: true })
  sku: string | null;

  @Column({ name: 'campaign_name', type: 'varchar', length: 255, nullable: true })
  campaignName: string | null;

  @Column({ name: 'product_name', type: 'varchar', length: 255, nullable: true })
  productName: string | null;

  @Column({ type: 'varchar', length: 50, default: 'post' })
  type: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  channel: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ type: 'mediumtext', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 5, default: 'th' })
  locale: string;

  @Index('idx_content_status')
  @Column({ type: 'enum', enum: ['draft', 'approved', 'scheduled', 'published'], default: 'draft' })
  status: ContentStatus;

  @Column({ name: 'scheduled_at', type: 'datetime', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'ai_request_id', type: 'bigint', unsigned: true, nullable: true })
  aiRequestId: number | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
