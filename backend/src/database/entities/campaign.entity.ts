import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'archived';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_campaigns_tenant')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'branch_id', type: 'bigint', unsigned: true, nullable: true })
  branchId: number | null;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  objective: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  channel: string | null;

  @Column({
    type: 'enum',
    enum: ['draft', 'scheduled', 'running', 'completed', 'archived'],
    default: 'draft',
  })
  status: CampaignStatus;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
