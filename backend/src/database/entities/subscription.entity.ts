import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Plan } from './plan.entity';
import { Tenant } from './tenant.entity';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'plan_id', type: 'bigint', unsigned: true })
  planId: number;

  @Column({
    type: 'enum',
    enum: ['trialing', 'active', 'past_due', 'canceled'],
    default: 'trialing',
  })
  status: SubscriptionStatus;

  @Column({ name: 'started_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ name: 'current_period_end', type: 'datetime', nullable: true })
  currentPeriodEnd: Date | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;
}
