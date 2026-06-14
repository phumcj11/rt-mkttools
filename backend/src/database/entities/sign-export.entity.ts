import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type SignExportFormat = 'png' | 'pdf';

@Entity('sign_exports')
@Index('idx_sign_exports_request', ['requestId'])
export class SignExport {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'request_id', type: 'bigint', unsigned: true })
  requestId: number;

  @Column({ type: 'enum', enum: ['png', 'pdf'] })
  format: SignExportFormat;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 512 })
  url: string;

  @Column({ name: 'local_path', type: 'varchar', length: 512 })
  localPath: string;

  @Column({ name: 'drive_file_id', type: 'varchar', length: 255, nullable: true })
  driveFileId: string | null;

  @Column({ name: 'drive_url', type: 'varchar', length: 512, nullable: true })
  driveUrl: string | null;

  @Column({ type: 'varchar', length: 50, default: 'ready' })
  status: 'ready' | 'drive_failed';

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
