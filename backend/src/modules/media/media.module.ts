import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpProductCache } from '../../database/entities/erp-product-cache.entity';
import { AiModule } from '../ai/ai.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { DriveService } from './drive.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { GeminiVideoProvider } from './providers/gemini-video.provider';
import { GrokVideoProvider } from './providers/grok-video.provider';
import { KlingVideoProvider } from './providers/kling-video.provider';
import { PromoCompositeService } from './promo-composite.service';
import { VideoService } from './video.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErpProductCache]),
    AiModule,
    SystemSettingsModule,
  ],
  controllers: [MediaController],
  providers: [MediaService, DriveService, VideoService, PromoCompositeService, GeminiVideoProvider, KlingVideoProvider, GrokVideoProvider],
  exports: [MediaService, DriveService, VideoService],
})
export class MediaModule {}
