import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, Post, Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ReplyDto } from './dto/reply.dto';
import { UpsertChannelDto } from './dto/upsert-channel.dto';
import { InboxService } from './inbox.service';

@Controller('inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  // ─── Channel configs ──────────────────────────────────────────────────

  @Get('channels')
  listChannels(@CurrentUser() user: AuthUser) {
    return this.inboxService.findChannels(user.tenantId);
  }

  @Post('channels')
  @Roles('super_admin', 'admin', 'marketing_manager')
  upsertChannel(@CurrentUser() user: AuthUser, @Body() dto: UpsertChannelDto) {
    return this.inboxService.upsertChannel(user.tenantId, dto);
  }

  @Delete('channels/:id')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  async deleteChannel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.inboxService.deleteChannel(user.tenantId, id);
    return { message: 'ลบ channel เรียบร้อย' };
  }

  // ─── Conversations ────────────────────────────────────────────────────

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.inboxService.findConversations(user.tenantId, status);
  }

  @Get('conversations/:id/messages')
  listMessages(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.inboxService.findMessages(user.tenantId, id);
  }

  @Post('conversations/:id/reply')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff', 'customer_service')
  sendReply(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyDto,
  ) {
    return this.inboxService.sendReply(user.tenantId, id, dto.content);
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.inboxService.markRead(user.tenantId, id);
  }

  @Post('conversations/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff', 'customer_service')
  resolve(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.inboxService.resolveConversation(user.tenantId, id);
  }
}
