import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ProductSyncStatus = 'running' | 'success' | 'failed';

@Entity('product_sync_runs')
export class ProductSyncRun {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'enum', enum: ['running', 'success', 'failed'], default: 'running' })
  status: ProductSyncStatus;

  @Column({ type: 'varchar', length: 50, default: 'manual' })
  source: string;

  @Column({ name: 'total_count', type: 'int', unsigned: true, default: 0 })
  totalCount: number;

  @Column({ name: 'new_count', type: 'int', unsigned: true, default: 0 })
  newCount: number;

  @Column({ name: 'changed_count', type: 'int', unsigned: true, default: 0 })
  changedCount: number;

  @Column({ name: 'inactive_count', type: 'int', unsigned: true, default: 0 })
  inactiveCount: number;

  @Column({ name: 'promotion_count', type: 'int', unsigned: true, default: 0 })
  promotionCount: number;

  @Column({ name: 'sales_count', type: 'int', unsigned: true, default: 0 })
  salesCount: number;

  @Column({ name: 'started_at', type: 'datetime' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
