import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SignAiResult,
  SignDraft,
  SignExport,
  SignRequest,
  SignRequestAsset,
  SignReview,
} from '../../database/entities';
import { AiModule } from '../ai/ai.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SignsController } from './signs.controller';
import { SignsService } from './signs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SignRequest, SignRequestAsset, SignAiResult, SignDraft, SignReview, SignExport]),
    AiModule,
    MediaModule,
    NotificationsModule,
  ],
  controllers: [SignsController],
  providers: [SignsService],
})
export class SignsModule {}
