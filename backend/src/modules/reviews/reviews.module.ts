import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleReview } from '../../database/entities';
import { AiModule } from '../ai/ai.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GoogleReview]),
    AiModule,
    SystemSettingsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
