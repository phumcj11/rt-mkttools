import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Cache ข้อมูล product master จาก ERP (ChangSiam)
 * sync ผ่าน POST /erp/sync/products
 * ใช้ใน Campaign Planner แทนการดึง ERP API ทุกครั้ง
 */
@Entity('erp_product_cache')
export class ErpProductCache {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  sku: string;

  @Column({ name: 'product_id', type: 'int', unsigned: true, default: 0 })
  productId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  name: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  category: string;

  @Index('idx_erp_product_brand')
  @Column({ type: 'varchar', length: 100, default: '' })
  brand: string;

  @Column({ name: 'retail_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  retailPrice: string;

  @Column({ name: 'cost_sales', type: 'decimal', precision: 12, scale: 2, default: 0 })
  costSales: string;

  @Column({ name: 'image_url', type: 'text', default: '' })
  imageUrl: string;

  @Column({ name: 'abc_company', type: 'varchar', length: 10, default: '' })
  abcCompany: string;

  @Index('idx_erp_product_first_seen')
  @Column({ name: 'first_seen_at', type: 'datetime', nullable: true })
  firstSeenAt: Date | null;

  @Index('idx_erp_product_last_seen')
  @Column({ name: 'last_seen_at', type: 'datetime', nullable: true })
  lastSeenAt: Date | null;

  @Column({ name: 'last_changed_at', type: 'datetime', nullable: true })
  lastChangedAt: Date | null;

  @Index('idx_erp_product_active')
  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive: boolean;

  @Column({ name: 'change_hash', type: 'char', length: 64, default: '' })
  changeHash: string;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt: Date;
}
