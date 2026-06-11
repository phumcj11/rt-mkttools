import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Subscription } from './subscription.entity';

export type PlanCode = 'free' | 'pro' | 'business';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  code: PlanCode;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'price_monthly', type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceMonthly: string;

  @Column({ name: 'ai_token_limit', type: 'bigint', unsigned: true, default: 0 })
  aiTokenLimit: number;

  @Column({ name: 'user_limit', type: 'int', unsigned: true, default: 1 })
  userLimit: number;

  @OneToMany(() => Subscription, (sub) => sub.plan)
  subscriptions: Subscription[];
}
