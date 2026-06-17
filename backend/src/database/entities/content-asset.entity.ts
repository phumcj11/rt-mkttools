import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ContentAssetStatus = 'generating' | 'ready' | 'approved' | 'rejected' | 'failed';
export type ContentAssetSource = 'manus' | 'upload' | 'system';

@Entity('content_assets')
export class ContentAsset {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_content_assets_tenant')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Index('idx_content_assets_content')
  @Column({ name: 'content_item_id', type: 'bigint', unsigned: true, nullable: true })
  contentItemId: number | null;

  @Index('idx_content_assets_sku')
  @Column({ type: 'varchar', length: 100, nullable: true })
  sku: string | null;

  @Column({ name: 'product_name', type: 'varchar', length: 255, nullable: true })
  productName: string | null;

  @Column({ type: 'varchar', length: 30, default: 'manus' })
  source: ContentAssetSource;

  @Index('idx_content_assets_status')
  @Column({ type: 'varchar', length: 30, default: 'generating' })
  status: ContentAssetStatus;

  @Column({ name: 'image_url', type: 'varchar', length: 1000, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'source_image_url', type: 'varchar', length: 1000, nullable: true })
  sourceImageUrl: string | null;

  @Column({ type: 'mediumtext', nullable: true })
  prompt: string | null;

  @Column({ name: 'manus_task_id', type: 'varchar', length: 255, nullable: true })
  manusTaskId: string | null;

  @Column({ name: 'manus_task_url', type: 'varchar', length: 1000, nullable: true })
  manusTaskUrl: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
