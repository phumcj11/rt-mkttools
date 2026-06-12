import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ChannelType = 'line' | 'facebook' | 'whatsapp' | 'webchat';

/** Credentials shape per channel (stored as JSON) */
export interface LineCredentials {
  channelSecret: string;
  channelAccessToken: string;
}
export interface FacebookCredentials {
  pageAccessToken: string;
  appSecret: string;
  verifyToken: string;
}
export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
}
export interface WebChatCredentials {
  widgetKey: string;
}

export type ChannelCredentials =
  | LineCredentials
  | FacebookCredentials
  | WhatsAppCredentials
  | WebChatCredentials;

@Entity('channel_configs')
export class ChannelConfig {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ type: 'varchar', length: 50 })
  channel: ChannelType;

  @Column({ name: 'page_id', type: 'varchar', length: 255 })
  pageId: string;

  @Column({ name: 'page_name', type: 'varchar', length: 255, default: '' })
  pageName: string;

  @Column({ type: 'json' })
  credentials: ChannelCredentials;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
