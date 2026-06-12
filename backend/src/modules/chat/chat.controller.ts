import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { InboxService } from '../inbox/inbox.service';
import { ChatService } from './chat.service';
import { CreateThreadDto } from './dto/create-thread.dto';

// ─── LINE webhook types ────────────────────────────────────────────────────
interface LineMessage { id: string; type: string; text?: string }
interface LineEvent {
  type: string;
  replyToken?: string;
  source: { type: string; userId?: string; groupId?: string };
  message?: LineMessage;
}
interface LineWebhookBody { destination: string; events: LineEvent[] }

// ─── Facebook webhook types ────────────────────────────────────────────────
interface FbMessage { mid: string; text?: string }
interface FbMessaging { sender: { id: string }; recipient: { id: string }; timestamp: number; message?: FbMessage }
interface FbEntry { id: string; time: number; messaging?: FbMessaging[] }
interface FbWebhookBody { object: string; entry: FbEntry[] }

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly inboxService: InboxService,
  ) {}

  // ─── AI Chat REST ──────────────────────────────────────────────────────────

  @Get('threads')
  listThreads(@CurrentUser() user: AuthUser) {
    return this.chatService.listThreads(user.tenantId, user.id);
  }

  @Post('threads')
  createThread(@CurrentUser() user: AuthUser, @Body() dto: CreateThreadDto) {
    return this.chatService.createThread(user.tenantId, user.id, dto.title ?? null);
  }

  @Get('threads/:id/messages')
  listMessages(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chatService.listMessages(user.tenantId, user.id, id);
  }

  @Delete('threads/:id')
  @HttpCode(HttpStatus.OK)
  async deleteThread(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.chatService.deleteThread(user.tenantId, user.id, id);
    return { message: 'ลบบทสนทนาเรียบร้อย' };
  }

  // ─── LINE webhook ──────────────────────────────────────────────────────────

  @Get('line-config')
  getLineConfig() {
    return {
      webhookUrl: '/api/chat/line-webhook',
      instructions: 'ตั้ง Webhook URL ใน LINE Developers Console และบันทึก credentials ผ่าน POST /api/inbox/channels',
    };
  }

  /**
   * LINE Messaging API webhook
   * ตั้ง Webhook URL: https://rt.k-mkt.com/api/chat/line-webhook
   * ระบบรองรับหลาย LINE channel (แยก credentials ผ่าน channel_configs)
   */
  @Public()
  @Post('line-webhook')
  @HttpCode(HttpStatus.OK)
  async lineWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: LineWebhookBody,
    @Headers('x-line-signature') signature: string,
  ) {
    if (!body?.events) return {};

    // ดึง channel_config ตาม destination (LINE channel ID)
    const destination = body.destination;
    const config = await this.inboxService.findChannelByPageId('line', destination);

    if (config) {
      // Verify X-Line-Signature
      const rawBody = req.rawBody;
      if (rawBody && signature) {
        const creds = config.credentials as { channelSecret: string };
        const expected = createHmac('sha256', creds.channelSecret)
          .update(rawBody)
          .digest('base64');
        const isValid = timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expected),
        );
        if (!isValid) {
          this.logger.warn(`LINE signature mismatch for destination ${destination}`);
          return {};
        }
      }

      for (const event of body.events) {
        if (event.type === 'message' && event.message?.type === 'text' && event.message.text) {
          const userId = event.source.userId ?? event.source.groupId ?? 'unknown';
          await this.inboxService.ingestMessage({
            tenantId: config.tenantId,
            channel: 'line',
            channelConfigId: config.id,
            externalId: userId,
            customerName: null,
            content: event.message.text,
            channelMsgId: event.message.id,
          });
        } else if (event.type === 'follow') {
          this.logger.log(`LINE follow: ${event.source.userId}`);
        } else if (event.type === 'unfollow') {
          this.logger.log(`LINE unfollow: ${event.source.userId}`);
        }
      }
    } else {
      this.logger.warn(`LINE webhook: no channel_config found for destination=${destination}. Configure at POST /api/inbox/channels`);
    }

    return {};
  }

  // ─── Facebook webhook ──────────────────────────────────────────────────────

  /**
   * Facebook Messenger webhook verification (GET)
   * ตั้ง Callback URL: https://rt.k-mkt.com/api/chat/fb-webhook
   */
  @Public()
  @Get('fb-webhook')
  fbWebhookVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token) {
      this.logger.log(`FB webhook verify: mode=${mode} token=${token}`);
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  /**
   * Facebook Messenger webhook events (POST)
   */
  @Public()
  @Post('fb-webhook')
  @HttpCode(HttpStatus.OK)
  async fbWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: FbWebhookBody,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    if (body?.object !== 'page') return {};

    for (const entry of body.entry ?? []) {
      const pageId = entry.id;
      const config = await this.inboxService.findChannelByPageId('facebook', pageId);

      if (config && signature) {
        const rawBody = req.rawBody;
        if (rawBody) {
          const creds = config.credentials as { appSecret: string };
          const expected = 'sha256=' + createHmac('sha256', creds.appSecret)
            .update(rawBody)
            .digest('hex');
          const isValid = timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected),
          );
          if (!isValid) {
            this.logger.warn(`FB signature mismatch for page ${pageId}`);
            continue;
          }
        }
      }

      for (const messaging of entry.messaging ?? []) {
        if (!messaging.message?.text) continue;
        const psid = messaging.sender.id;

        if (config) {
          await this.inboxService.ingestMessage({
            tenantId: config.tenantId,
            channel: 'facebook',
            channelConfigId: config.id,
            externalId: psid,
            content: messaging.message.text,
            channelMsgId: messaging.message.mid,
          });
        } else {
          this.logger.warn(`FB webhook: no channel_config found for pageId=${pageId}. Configure at POST /api/inbox/channels`);
        }
      }
    }

    return {};
  }
}
