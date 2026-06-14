import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type SignReviewDecision = 'approve' | 'reject' | 'need_more_info';

@Entity('sign_reviews')
@Index('idx_sign_reviews_request', ['requestId'])
export class SignReview {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'request_id', type: 'bigint', unsigned: true })
  requestId: number;

  @Column({ name: 'reviewer_id', type: 'bigint', unsigned: true, nullable: true })
  reviewerId: number | null;

  @Column({ type: 'enum', enum: ['approve', 'reject', 'need_more_info'] })
  decision: SignReviewDecision;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'edited_fields', type: 'simple-json', nullable: true })
  editedFields: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
