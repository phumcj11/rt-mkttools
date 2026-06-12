import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpProductCache } from '../../database/entities/erp-product-cache.entity';
import { AiModule } from '../ai/ai.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { DriveService } from './drive.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { VideoService } from './video.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErpProductCache]),
    AiModule,
    SystemSettingsModule,
  ],
  controllers: [MediaController],
  providers: [MediaService, DriveService, VideoService],
  exports: [MediaService, DriveService, VideoService],
})
export class MediaModule {}
