import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelConfig, ContentAsset, ContentItem, ContentPublishJob } from '../../database/entities';
import { InboxModule } from '../inbox/inbox.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { BlotatoService } from './blotato.service';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ManusContentService } from './manus-content.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentItem, ContentAsset, ContentPublishJob, ChannelConfig]),
    NotificationsModule,
    InboxModule,
    SystemSettingsModule,
  ],
  controllers: [ContentController],
  providers: [ContentService, ManusContentService, BlotatoService],
  exports: [ContentService],
})
export class ContentModule {}
