import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type SignAssetKind = 'product' | 'current_sign' | 'shelf' | 'other';

@Entity('sign_request_assets')
@Index('idx_sign_assets_request', ['requestId'])
export class SignRequestAsset {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'request_id', type: 'bigint', unsigned: true })
  requestId: number;

  @Column({ type: 'enum', enum: ['product', 'current_sign', 'shelf', 'other'], default: 'other' })
  kind: SignAssetKind;

  @Column({ name: 'original_name', type: 'varchar', length: 255, nullable: true })
  originalName: string | null;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 512 })
  url: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
