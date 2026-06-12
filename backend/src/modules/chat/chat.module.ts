import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage, ChatThread } from '../../database/entities';
import { AiModule } from '../ai/ai.module';
import { InboxModule } from '../inbox/inbox.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatThread, ChatMessage]),
    AiModule,
    forwardRef(() => InboxModule),
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
