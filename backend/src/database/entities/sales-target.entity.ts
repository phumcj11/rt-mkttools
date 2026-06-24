import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sales_targets')
@Index('uq_sales_target', ['tenantId', 'yearMonth', 'branchId'], { unique: true })
export class SalesTarget {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_sales_target_tenant')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Index('idx_sales_target_month')
  @Column({ name: 'year_month', type: 'char', length: 7 })
  yearMonth: string;

  /** NULL = company-wide target */
  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branchId: number | null;

  @Column({ name: 'branch_code', type: 'varchar', length: 50, nullable: true })
  branchCode: string | null;

  @Column({ name: 'target_revenue', type: 'decimal', precision: 16, scale: 2, default: 0 })
  targetRevenue: string;

  @Column({ name: 'target_transactions', type: 'int', unsigned: true, nullable: true })
  targetTransactions: number | null;

  @Column({ name: 'target_avg_ticket', type: 'decimal', precision: 12, scale: 2, nullable: true })
  targetAvgTicket: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
