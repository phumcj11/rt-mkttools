import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelConfig, ContentItem } from '../../database/entities';
import { InboxModule } from '../inbox/inbox.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentItem, ChannelConfig]),
    NotificationsModule,
    InboxModule,
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
