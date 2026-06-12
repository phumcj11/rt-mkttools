import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ChatService } from './chat.service';
import { CreateThreadDto } from './dto/create-thread.dto';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);
  constructor(private readonly chatService: ChatService) {}

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

  /**
   * LINE Messaging API Webhook
   * URL: POST /api/chat/line-webhook
   * ตั้ง Webhook URL นี้ใน LINE Developers Console:
   *   https://<domain>/api/chat/line-webhook
   * ต้องตั้งค่า LINE_CHANNEL_SECRET และ LINE_CHANNEL_ACCESS_TOKEN ใน .env
   */
  @Public()
  @Post('line-webhook')
  @HttpCode(HttpStatus.OK)
  async lineWebhook(@Req() req: RawBodyRequest<Request>, @Body() body: Record<string, unknown>) {
    this.logger.log(`LINE webhook received: ${JSON.stringify(body).slice(0, 200)}`);
    // TODO: verify X-Line-Signature with LINE_CHANNEL_SECRET then process events
    // See: https://developers.line.biz/en/docs/messaging-api/receiving-messages/
    return {};
  }

  @Get('line-config')
  getLineConfig() {
    const configured = !!(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);
    return {
      configured,
      webhookUrl: '/api/chat/line-webhook',
      instructions: 'ตั้ง Webhook URL ใน LINE Developers Console และเพิ่ม LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN ใน .env',
    };
  }
}
