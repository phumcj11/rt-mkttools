import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import {
  ChannelConfig,
  ChannelType,
  Conversation,
  InboxMessage,
} from '../../database/entities';
import { RealtimeService } from '../realtime/realtime.service';
import { ChannelService } from './channel.service';
import { UpsertChannelDto } from './dto/upsert-channel.dto';

export interface IngestParams {
  tenantId: number;
  channel: string;
  channelConfigId: number | null;
  externalId: string;
  customerName?: string | null;
  customerHandle?: string | null;
  content: string;
  channelMsgId?: string | null;
  mediaUrl?: string | null;
}

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    @InjectRepository(ChannelConfig)  private readonly configRepo: Repository<ChannelConfig>,
    @InjectRepository(Conversation)   private readonly convRepo: Repository<Conversation>,
    @InjectRepository(InboxMessage)   private readonly msgRepo: Repository<InboxMessage>,
    private readonly channelService: ChannelService,
    private readonly realtime: RealtimeService,
  ) {}

  // ─── Channel configs ──────────────────────────────────────────────────

  findChannels(tenantId: number) {
    return this.configRepo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async upsertChannel(tenantId: number, dto: UpsertChannelDto): Promise<ChannelConfig> {
    let config = await this.configRepo.findOne({
      where: { tenantId, channel: dto.channel, pageId: dto.pageId },
    });
    if (config) {
      config.pageName    = dto.pageName ?? config.pageName;
      config.credentials = dto.credentials as unknown as ChannelConfig['credentials'];
      config.isActive    = dto.isActive ?? config.isActive;
    } else {
      config = this.configRepo.create({
        tenantId,
        channel: dto.channel,
        pageId: dto.pageId,
        pageName: dto.pageName ?? '',
        credentials: dto.credentials as unknown as ChannelConfig['credentials'],
        isActive: dto.isActive ?? true,
      });
    }
    return this.configRepo.save(config);
  }

  async deleteChannel(tenantId: number, id: number): Promise<void> {
    const config = await this.configRepo.findOne({ where: { id, tenantId } });
    if (!config) throw new NotFoundAppException();
    await this.configRepo.remove(config);
  }

  async findChannelByPageId(channel: string, pageId: string): Promise<ChannelConfig | null> {
    return this.configRepo.findOne({ where: { channel: channel as ChannelType, pageId, isActive: true } });
  }

  // ─── Conversations ────────────────────────────────────────────────────

  findConversations(tenantId: number, status?: string) {
    return this.convRepo.find({
      where: { tenantId, ...(status ? { status: status as Conversation['status'] } : {}) },
      order: { lastMessageAt: 'DESC' },
      take: 100,
    });
  }

  async findConversation(tenantId: number, id: number): Promise<Conversation> {
    const conv = await this.convRepo.findOne({ where: { id, tenantId } });
    if (!conv) throw new NotFoundAppException();
    return conv;
  }

  async markRead(tenantId: number, id: number): Promise<Conversation> {
    const conv = await this.findConversation(tenantId, id);
    conv.unreadCount = 0;
    return this.convRepo.save(conv);
  }

  async resolveConversation(tenantId: number, id: number): Promise<Conversation> {
    const conv = await this.findConversation(tenantId, id);
    conv.status = 'resolved';
    return this.convRepo.save(conv);
  }

  // ─── Messages ─────────────────────────────────────────────────────────

  findMessages(tenantId: number, conversationId: number) {
    return this.msgRepo.find({
      where: { conversationId, tenantId },
      order: { sentAt: 'ASC' },
      take: 200,
    });
  }

  // ─── Ingest inbound message ───────────────────────────────────────────

  async ingestMessage(params: IngestParams): Promise<{ conversation: Conversation; message: InboxMessage }> {
    // Upsert conversation
    let conv = await this.convRepo.findOne({
      where: { tenantId: params.tenantId, channel: params.channel, externalId: params.externalId },
    });
    if (!conv) {
      conv = this.convRepo.create({
        tenantId: params.tenantId,
        channel: params.channel,
        channelConfigId: params.channelConfigId,
        externalId: params.externalId,
        customerName: params.customerName ?? null,
        customerHandle: params.customerHandle ?? null,
        status: 'open',
      });
    }
    conv.lastMessageAt = new Date();
    conv.unreadCount += 1;
    if (params.customerName && !conv.customerName) conv.customerName = params.customerName;
    conv = await this.convRepo.save(conv);

    // Append message
    const msg = await this.msgRepo.save(
      this.msgRepo.create({
        conversationId: conv.id,
        tenantId: params.tenantId,
        direction: 'in',
        content: params.content,
        mediaUrl: params.mediaUrl ?? null,
        channelMsgId: params.channelMsgId ?? null,
      }),
    );

    // Realtime push to tenant room
    this.realtime.emitToTenant(params.tenantId, 'inbox:new', {
      conversationId: conv.id,
      channel: conv.channel,
      customerName: conv.customerName,
      content: params.content,
      unreadCount: conv.unreadCount,
    });

    this.logger.log(`Inbound ${params.channel} from ${params.externalId}: ${params.content.slice(0, 60)}`);
    return { conversation: conv, message: msg };
  }

  // ─── Send reply ───────────────────────────────────────────────────────

  async sendReply(
    tenantId: number,
    conversationId: number,
    content: string,
    meta?: { replyToken?: string },
  ): Promise<InboxMessage> {
    const conv = await this.findConversation(tenantId, conversationId);

    // Save outbound message first
    const msg = await this.msgRepo.save(
      this.msgRepo.create({
        conversationId: conv.id,
        tenantId,
        direction: 'out',
        content,
      }),
    );

    // Dispatch to channel
    if (conv.channelConfigId) {
      const config = await this.configRepo.findOne({ where: { id: conv.channelConfigId } });
      if (config) {
        if (conv.channel === 'line' && meta?.replyToken) {
          await this.channelService.replyLine(config, meta.replyToken, content);
        } else if (conv.channel === 'line') {
          await this.channelService.pushLine(config, conv.externalId, content);
        } else if (conv.channel === 'facebook') {
          await this.channelService.replyFacebook(config, conv.externalId, content);
        }
      }
    }

    // Update conversation
    conv.lastMessageAt = new Date();
    await this.convRepo.save(conv);

    // Realtime push
    this.realtime.emitToTenant(tenantId, 'inbox:reply', {
      conversationId: conv.id,
      messageId: msg.id,
      content,
    });

    return msg;
  }
}
