import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('erp_campaign_cache')
export class ErpCampaignCache {
  @PrimaryColumn({ name: 'campaign_id', type: 'int', unsigned: true })
  campaignId: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  @Index('idx_erp_campaign_type')
  @Column({ name: 'promotion_type', type: 'varchar', length: 100, nullable: true })
  promotionType: string | null;

  @Column({ name: 'promotion_type_name', type: 'varchar', length: 200, nullable: true })
  promotionTypeName: string | null;

  @Column({ name: 'date_start', type: 'varchar', length: 20, nullable: true })
  dateStart: string | null;

  @Column({ name: 'date_stop', type: 'varchar', length: 20, nullable: true })
  dateStop: string | null;

  @Column({ name: 'retail_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  retailPrice: string;

  @Column({ name: 'promo_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  promoPrice: string;

  @Column({ name: 'discount_pct', type: 'decimal', precision: 6, scale: 2, default: 0 })
  discountPct: string;

  @Index('idx_erp_campaign_active')
  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive: boolean;

  @Column({ name: 'product_count', type: 'int', unsigned: true, default: 0 })
  productCount: number;

  /** Campaign-level conditions from promotions/detail */
  @Column({ type: 'text', nullable: true })
  conditions: string | null;

  /** Free items from promotions/free_items */
  @Column({ name: 'free_items', type: 'json', nullable: true })
  freeItems: Array<{
    sku: string;
    productId: number;
    name: string;
    qty: number;
  }> | null;

  /** Products in this campaign with individual promo prices and step conditions */
  @Column({ type: 'json', nullable: true })
  products: Array<{
    sku: string;
    productId: number;
    name: string;
    imageUrl: string;
    promoPrice: number;
    retailPrice: number;
    /** Minimum purchase quantity for the promotion */
    minQty: number;
    /** Free item quantity (for buy-X-get-Y type) */
    freeItemQty: number;
    /** GP% after promotion price */
    gp: number | null;
    /** Human-readable step label e.g. "ซื้อ 2 ได้ราคา ฿89" */
    stepText: string;
  }> | null;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt: Date;
}
