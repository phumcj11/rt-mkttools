import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SignRequestStatus =
  | 'submitted'
  | 'ai_processing'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'need_more_info'
  | 'exported';

export type SignType = 'price_tag' | 'promotion' | 'benefit_card' | 'shelf_tag';
export type SignSize = 'a5' | 'a6' | 'a7' | 'shelf_tag';

@Entity('sign_requests')
@Index('idx_sign_requests_tenant_status', ['tenantId', 'status'])
@Index('idx_sign_requests_tenant_branch', ['tenantId', 'branchName'])
export class SignRequest {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'requester_id', type: 'bigint', unsigned: true, nullable: true })
  requesterId: number | null;

  @Column({ name: 'reviewer_id', type: 'bigint', unsigned: true, nullable: true })
  reviewerId: number | null;

  @Column({ name: 'request_no', type: 'varchar', length: 40 })
  requestNo: string;

  @Column({ name: 'branch_name', type: 'varchar', length: 150 })
  branchName: string;

  @Column({ name: 'requester_name', type: 'varchar', length: 150 })
  requesterName: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  sku: string | null;

  @Column({ name: 'product_name', type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  promotion: string | null;

  @Column({ name: 'sign_type', type: 'enum', enum: ['price_tag', 'promotion', 'benefit_card', 'shelf_tag'] })
  signType: SignType;

  @Column({ name: 'sign_size', type: 'enum', enum: ['a5', 'a6', 'a7', 'shelf_tag'] })
  signSize: SignSize;

  @Column({ name: 'template_id', type: 'bigint', unsigned: true, nullable: true })
  templateId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  headline: string | null;

  @Column({ type: 'text', nullable: true })
  benefits: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: ['submitted', 'ai_processing', 'pending_review', 'approved', 'rejected', 'need_more_info', 'exported'],
    default: 'submitted',
  })
  status: SignRequestStatus;

  @Column({ name: 'status_note', type: 'text', nullable: true })
  statusNote: string | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'exported_at', type: 'datetime', nullable: true })
  exportedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
