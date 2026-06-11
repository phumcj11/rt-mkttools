import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ReviewSentiment = 'positive' | 'neutral' | 'negative';

@Entity('google_reviews')
export class GoogleReview {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'branch_id', type: 'bigint', unsigned: true, nullable: true })
  branchId: number | null;

  @Column({ name: 'google_review_id', type: 'varchar', length: 255, nullable: true, unique: true })
  googleReviewId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  author: string | null;

  @Column({ type: 'tinyint', unsigned: true })
  rating: number;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sentiment: ReviewSentiment | null;

  @Column({ name: 'ai_reply', type: 'text', nullable: true })
  aiReply: string | null;

  @Column({ name: 'replied_at', type: 'timestamp', nullable: true })
  repliedAt: Date | null;

  @Column({ name: 'review_date', type: 'date', nullable: true })
  reviewDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
