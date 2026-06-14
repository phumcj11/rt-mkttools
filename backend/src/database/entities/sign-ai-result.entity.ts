import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sign_ai_results')
@Index('idx_sign_ai_results_request', ['requestId'])
export class SignAiResult {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'request_id', type: 'bigint', unsigned: true })
  requestId: number;

  @Column({ name: 'extracted_product_name', type: 'varchar', length: 255, nullable: true })
  extractedProductName: string | null;

  @Column({ name: 'extracted_price', type: 'varchar', length: 80, nullable: true })
  extractedPrice: string | null;

  @Column({ name: 'extracted_promotion', type: 'varchar', length: 255, nullable: true })
  extractedPromotion: string | null;

  @Column({ name: 'headline', type: 'varchar', length: 255, nullable: true })
  headline: string | null;

  @Column({ name: 'benefits', type: 'simple-json', nullable: true })
  benefits: string[] | null;

  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText: string | null;

  @Column({ name: 'model', type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
