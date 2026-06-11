import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AiRequestStatus = 'pending' | 'success' | 'error';

@Entity('ai_requests')
export class AiRequest {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_airequests_tenant')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, nullable: true })
  userId: number | null;

  @Column({ name: 'template_id', type: 'bigint', unsigned: true, nullable: true })
  templateId: number | null;

  @Column({ type: 'varchar', length: 60 })
  model: string;

  @Column({ type: 'mediumtext' })
  prompt: string;

  @Column({ type: 'mediumtext', nullable: true })
  response: string | null;

  @Column({ name: 'prompt_tokens', type: 'int', unsigned: true, default: 0 })
  promptTokens: number;

  @Column({ name: 'completion_tokens', type: 'int', unsigned: true, default: 0 })
  completionTokens: number;

  @Column({ type: 'enum', enum: ['pending', 'success', 'error'], default: 'pending' })
  status: AiRequestStatus;

  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
