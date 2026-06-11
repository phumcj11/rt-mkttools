import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ChatService } from './chat.service';
import { CreateThreadDto } from './dto/create-thread.dto';

@Controller('chat')
export class ChatController {
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
}
