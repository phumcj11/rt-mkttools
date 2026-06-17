import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ContentPublishProvider = 'blotato';
export type ContentPublishStatus = 'queued' | 'submitted' | 'published' | 'failed';

@Entity('content_publish_jobs')
export class ContentPublishJob {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_publish_jobs_tenant')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Index('idx_publish_jobs_content')
  @Column({ name: 'content_item_id', type: 'bigint', unsigned: true })
  contentItemId: number;

  @Index('idx_publish_jobs_asset')
  @Column({ name: 'asset_id', type: 'bigint', unsigned: true, nullable: true })
  assetId: number | null;

  @Column({ type: 'varchar', length: 30, default: 'blotato' })
  provider: ContentPublishProvider;

  @Column({ type: 'varchar', length: 50 })
  platform: string;

  @Index('idx_publish_jobs_status')
  @Column({ type: 'varchar', length: 30, default: 'queued' })
  status: ContentPublishStatus;

  @Column({ name: 'blotato_submission_id', type: 'varchar', length: 255, nullable: true })
  blotatoSubmissionId: string | null;

  @Column({ name: 'public_url', type: 'varchar', length: 1000, nullable: true })
  publicUrl: string | null;

  @Column({ name: 'scheduled_at', type: 'datetime', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'json', nullable: true })
  request: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  response: Record<string, unknown> | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
