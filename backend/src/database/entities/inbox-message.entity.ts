import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('inbox_messages')
export class InboxMessage {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_im_conv')
  @Column({ name: 'conversation_id', type: 'bigint', unsigned: true })
  conversationId: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ type: 'enum', enum: ['in', 'out'] })
  direction: 'in' | 'out';

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'media_url', type: 'varchar', length: 512, nullable: true })
  mediaUrl: string | null;

  @Column({ name: 'channel_msg_id', type: 'varchar', length: 512, nullable: true })
  channelMsgId: string | null;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
