import { Column, Entity, Unique, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ai_usage')
@Unique('uq_aiusage_tenant_period', ['tenantId', 'periodMonth'])
export class AiUsage {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'period_month', type: 'char', length: 7 })
  periodMonth: string;

  @Column({ name: 'total_tokens', type: 'bigint', unsigned: true, default: 0 })
  totalTokens: number;

  @Column({ name: 'total_requests', type: 'int', unsigned: true, default: 0 })
  totalRequests: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
