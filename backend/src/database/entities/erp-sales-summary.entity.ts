import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Cache ยอดขายสรุปรายสินค้า (SKU) จาก ERP
 * sync ผ่าน POST /erp/sync/sales
 * เก็บช่วง 90 วันล่าสุดโดยค่าเริ่มต้น
 */
@Entity('erp_sales_summary')
export class ErpSalesSummary {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  sku: string;

  @Column({ name: 'product_id', type: 'int', unsigned: true, default: 0 })
  productId: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  revenue: string;

  @Column({ name: 'qty_sold', type: 'int', unsigned: true, default: 0 })
  qtySold: number;

  @Column({ name: 'gp_baht', type: 'decimal', precision: 16, scale: 2, default: 0 })
  gpBaht: string;

  @Column({ name: 'gp_pct', type: 'decimal', precision: 6, scale: 2, default: 0 })
  gpPct: string;

  @Column({ name: 'abc_company', type: 'varchar', length: 10, default: '' })
  abcCompany: string;

  @Column({ name: 'period_days', type: 'int', unsigned: true, default: 90 })
  periodDays: number;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt: Date;
}
