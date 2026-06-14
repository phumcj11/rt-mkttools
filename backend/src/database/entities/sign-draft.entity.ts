import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sign_drafts')
@Index('idx_sign_drafts_request', ['requestId'])
export class SignDraft {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'request_id', type: 'bigint', unsigned: true })
  requestId: number;

  @Column({ type: 'int', unsigned: true, default: 1 })
  version: number;

  @Column({ name: 'template_id', type: 'varchar', length: 80 })
  templateId: string;

  @Column({ name: 'preview_url', type: 'varchar', length: 512 })
  previewUrl: string;

  @Column({ name: 'preview_path', type: 'varchar', length: 512 })
  previewPath: string;

  @Column({ name: 'editable_fields', type: 'simple-json', nullable: true })
  editableFields: Record<string, unknown> | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
