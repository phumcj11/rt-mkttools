import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CustomerMixSource = 'manual' | 'import' | 'estimate';

@Entity('branch_customer_mix_daily')
@Index('uq_customer_mix', ['tenantId', 'branchId', 'mixDate', 'customerType'], { unique: true })
export class BranchCustomerMixDaily {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'branch_id', type: 'int' })
  branchId: number;

  @Column({ name: 'branch_code', type: 'varchar', length: 50, nullable: true })
  branchCode: string | null;

  @Column({ name: 'mix_date', type: 'date' })
  mixDate: string;

  @Column({ name: 'customer_type', type: 'varchar', length: 50 })
  customerType: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  count: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pct: string | null;

  @Column({ type: 'enum', enum: ['manual', 'import', 'estimate'], default: 'manual' })
  source: CustomerMixSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
