import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * สแนปช็อตยอดขายรายวันที่ดึงจาก ERP (ChangSiam) — เก็บไว้ทำรายงานย้อนหลัง
 * และตรวจจับความผิดปกติ (alerts) แม้ ERP จะเปิดให้ดูย้อนหลังจำกัด
 * เป็นข้อมูลอ้างอิงระดับระบบ (ไม่ผูกกับ tenant)
 */
@Entity('erp_sales_daily')
export class ErpSalesDaily {
  @PrimaryColumn({ name: 'sale_date', type: 'date' })
  saleDate: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  orders: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  revenue: string;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt: Date;
}
