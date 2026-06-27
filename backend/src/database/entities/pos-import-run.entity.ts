import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PosImportRunStatus = 'running' | 'completed' | 'failed';

@Entity('pos_import_runs')
@Index('idx_pos_import_run_tenant_month', ['tenantId', 'yearMonth'])
@Index('idx_pos_import_run_file', ['driveFileId'])
export class PosImportRun {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'year_month', type: 'char', length: 7 })
  yearMonth: string;

  @Column({ name: 'drive_file_id', type: 'varchar', length: 255, nullable: true })
  driveFileId: string | null;

  @Column({ name: 'filename', type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: PosImportRunStatus;

  @Column({ name: 'total_rows', type: 'int', unsigned: true, default: 0 })
  totalRows: number;

  @Column({ name: 'imported_rows', type: 'int', unsigned: true, default: 0 })
  importedRows: number;

  @Column({ name: 'skipped_rows', type: 'int', unsigned: true, default: 0 })
  skippedRows: number;

  @Column({ name: 'receipt_count', type: 'int', unsigned: true, default: 0 })
  receiptCount: number;

  @Column({ name: 'branch_count', type: 'int', unsigned: true, default: 0 })
  branchCount: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'imported_at', type: 'timestamp', nullable: true })
  importedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
