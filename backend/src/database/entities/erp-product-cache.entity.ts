import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

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

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt: Date;
}
