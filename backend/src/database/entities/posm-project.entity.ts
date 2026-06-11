import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PosmType =
  | 'price_tag'
  | 'shelf_talker'
  | 'wobbler'
  | 'promotion_a4'
  | 'review_poster'
  | 'sale_tag';

@Entity('posm_projects')
export class PosmProject {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', length: 50 })
  type: PosmType;

  @Column({ name: 'product_name', type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  promotion: string | null;

  @Column({ name: 'output_url', type: 'varchar', length: 512, nullable: true })
  outputUrl: string | null;

  @Column({ type: 'enum', enum: ['pending', 'done', 'error'], default: 'pending' })
  status: 'pending' | 'done' | 'error';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
