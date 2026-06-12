import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelConfig, Conversation, InboxMessage } from '../../database/entities';
import { ChannelService } from './channel.service';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChannelConfig, Conversation, InboxMessage])],
  controllers: [InboxController],
  providers: [InboxService, ChannelService],
  exports: [InboxService, ChannelService],
})
export class InboxModule {}
