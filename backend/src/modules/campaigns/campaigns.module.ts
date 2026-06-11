import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign, Promotion } from '../../database/entities';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PromotionsController } from './promotions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, Promotion])],
  controllers: [CampaignsController, PromotionsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
