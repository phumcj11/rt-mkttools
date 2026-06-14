import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { SignSize, SignType } from './sign-request.entity';

@Entity('sign_templates')
@Index('idx_sign_templates_tenant', ['tenantId'])
export class SignTemplate {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'sign_type', type: 'enum', enum: ['price_tag', 'promotion', 'benefit_card', 'shelf_tag'], nullable: true })
  signType: SignType | null;

  @Column({ name: 'sign_size', type: 'enum', enum: ['a5', 'a6', 'a7', 'shelf_tag'], nullable: true })
  signSize: SignSize | null;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 512 })
  url: string;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
