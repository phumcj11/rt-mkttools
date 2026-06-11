import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type DiscountType = 'percent' | 'amount' | 'bundle';

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_promotions_tenant')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'campaign_id', type: 'bigint', unsigned: true, nullable: true })
  campaignId: number | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: ['percent', 'amount', 'bundle'],
    default: 'percent',
  })
  discountType: DiscountType;

  @Column({
    name: 'discount_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => (v === null ? null : Number(v)) },
  })
  discountValue: number;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
