import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

export type InvoiceStatus = 'open' | 'paid' | 'void';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'subscription_id', type: 'bigint', unsigned: true, nullable: true })
  subscriptionId: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'char', length: 3, default: 'THB' })
  currency: string;

  @Column({ type: 'enum', enum: ['open', 'paid', 'void'], default: 'open' })
  status: InvoiceStatus;

  @Column({ name: 'issued_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  issuedAt: Date;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
