import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ChatRole = 'user' | 'assistant' | 'system';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_messages_thread')
  @Column({ name: 'thread_id', type: 'bigint', unsigned: true })
  threadId: number;

  @Column({ type: 'enum', enum: ['user', 'assistant', 'system'] })
  role: ChatRole;

  @Column({ type: 'mediumtext' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
