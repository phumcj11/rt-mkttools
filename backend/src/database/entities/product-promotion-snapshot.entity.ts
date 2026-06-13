import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('product_promotion_snapshot')
export class ProductPromotionSnapshot {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  sku: string;

  @Index('idx_product_promo_product_id')
  @Column({ name: 'product_id', type: 'int', unsigned: true, default: 0 })
  productId: number;

  @Index('idx_product_promo_active_count')
  @Column({ name: 'active_promotion_count', type: 'int', unsigned: true, default: 0 })
  activePromotionCount: number;

  @Column({ name: 'promotion_names', type: 'text', nullable: true })
  promotionNames: string | null;

  @Column({ name: 'promotion_types', type: 'text', nullable: true })
  promotionTypes: string | null;

  @Column({ name: 'lowest_promo_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  lowestPromoPrice: string | null;

  @Column({ name: 'best_remaining_gp_pct', type: 'decimal', precision: 6, scale: 2, nullable: true })
  bestRemainingGpPct: string | null;

  @Column({ type: 'json', nullable: true })
  promotions: Array<{
    id: number;
    name: string;
    type: string;
    typeName?: string;
    promoPrice: number;
    retailPrice: number;
    conditions: string;
    remainingGpPct: number | null;
  }> | null;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt: Date;
}
