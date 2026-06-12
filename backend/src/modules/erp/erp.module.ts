import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpProductCache, ErpSalesDaily, ErpSalesSummary } from '../../database/entities';
import { AiModule } from '../ai/ai.module';
import { ErpInsightsService } from './erp-insights.service';
import { ErpSyncService } from './erp-sync.service';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErpSalesDaily, ErpProductCache, ErpSalesSummary]),
    AiModule,
  ],
  controllers: [ErpController],
  providers: [ErpService, ErpInsightsService, ErpSyncService],
  exports: [ErpService, ErpSyncService],
})
export class ErpModule {}
