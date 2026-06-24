import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TrafficSource = 'manual' | 'import' | 'camera';

@Entity('branch_traffic_daily')
@Index('uq_branch_traffic', ['tenantId', 'branchId', 'trafficDate'], { unique: true })
export class BranchTrafficDaily {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'branch_id', type: 'int' })
  branchId: number;

  @Column({ name: 'branch_code', type: 'varchar', length: 50, nullable: true })
  branchCode: string | null;

  @Column({ name: 'traffic_date', type: 'date' })
  trafficDate: string;

  @Column({ name: 'foot_traffic', type: 'int', unsigned: true, default: 0 })
  footTraffic: number;

  @Column({ type: 'int', unsigned: true, nullable: true })
  transactions: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'enum', enum: ['manual', 'import', 'camera'], default: 'manual' })
  source: TrafficSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
