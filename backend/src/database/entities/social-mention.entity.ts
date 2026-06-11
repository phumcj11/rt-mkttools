import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('social_mentions')
export class SocialMention {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ type: 'varchar', length: 100 })
  platform: string;

  @Column({ type: 'varchar', length: 255 })
  keyword: string;

  @Column({ name: 'author_handle', type: 'varchar', length: 255, nullable: true })
  authorHandle: string | null;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  sentiment: 'positive' | 'neutral' | 'negative' | null;

  @Column({ name: 'is_viral', type: 'boolean', default: false })
  isViral: boolean;

  @Column({ name: 'source_url', type: 'varchar', length: 512, nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('listening_keywords')
export class ListeningKeyword {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ type: 'varchar', length: 255 })
  keyword: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
