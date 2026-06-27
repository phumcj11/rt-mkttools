import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('pos_sales_lines')
@Index('uq_pos_sales_line', ['tenantId', 'yearMonth', 'receiptNo', 'sku', 'saleDateTime', 'lineIndex'], { unique: true })
@Index('idx_pos_sales_tenant_month_branch', ['tenantId', 'yearMonth', 'branchCode'])
@Index('idx_pos_sales_receipt', ['tenantId', 'receiptNo'])
@Index('idx_pos_sales_date', ['tenantId', 'saleDate'])
@Index('idx_pos_sales_sku', ['tenantId', 'sku'])
@Index('idx_pos_sales_nationality', ['tenantId', 'yearMonth', 'nationality'])
export class PosSalesLine {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'year_month', type: 'char', length: 7 })
  yearMonth: string;

  @Column({ name: 'import_run_id', type: 'bigint', unsigned: true, nullable: true })
  importRunId: number | null;

  @Column({ name: 'line_index', type: 'int', unsigned: true })
  lineIndex: number;

  @Column({ name: 'product_name', type: 'varchar', length: 500, nullable: true })
  productName: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  sku: string | null;

  @Column({ name: 'receipt_no', type: 'varchar', length: 80 })
  receiptNo: string;

  @Column({ name: 'sale_date', type: 'date' })
  saleDate: string;

  @Column({ name: 'sale_datetime', type: 'datetime', nullable: true })
  saleDateTime: string | null;

  @Column({ name: 'branch_code', type: 'varchar', length: 50 })
  branchCode: string;

  @Column({ name: 'qty', type: 'decimal', precision: 12, scale: 3, default: 0 })
  qty: string;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitCost: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ name: 'line_amount_before_vat', type: 'decimal', precision: 14, scale: 2, default: 0 })
  lineAmountBeforeVat: string;

  @Column({ name: 'vat_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  vatAmount: string;

  @Column({ name: 'line_total', type: 'decimal', precision: 14, scale: 2, default: 0 })
  lineTotal: string;

  @Column({ name: 'discount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  discount: string;

  @Column({ name: 'approved_discount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  approvedDiscount: string;

  @Column({ name: 'net_amount_before_vat', type: 'decimal', precision: 14, scale: 2, default: 0 })
  netAmountBeforeVat: string;

  @Column({ name: 'net_total', type: 'decimal', precision: 14, scale: 2, default: 0 })
  netTotal: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 80, nullable: true })
  paymentMethod: string | null;

  @Column({ name: 'nationality', type: 'varchar', length: 80, nullable: true })
  nationality: string | null;

  @Column({ name: 'ar_name', type: 'varchar', length: 255, nullable: true })
  arName: string | null;

  @Column({ name: 'promotion_name', type: 'varchar', length: 500, nullable: true })
  promotionName: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
