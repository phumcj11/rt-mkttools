import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sales_records')
export class SalesRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_sales_tenant_date')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'product_id', type: 'bigint', unsigned: true, nullable: true })
  productId: number | null;

  @Column({ name: 'campaign_id', type: 'bigint', unsigned: true, nullable: true })
  campaignId: number | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => (v === null ? 0 : Number(v)) },
  })
  amount: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  quantity: number;

  @Column({ name: 'sold_at', type: 'datetime' })
  soldAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
