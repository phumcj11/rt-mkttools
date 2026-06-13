import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ErpProductCache,
  ErpSalesDaily,
  ErpSalesSummary,
  ProductPromotionSnapshot,
  ProductSyncRun,
} from '../../database/entities';
import { AiModule } from '../ai/ai.module';
import { ErpInsightsService } from './erp-insights.service';
import { ErpProductSyncScheduler } from './erp-product-sync.scheduler';
import { ErpSyncService } from './erp-sync.service';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpSalesDaily,
      ErpProductCache,
      ErpSalesSummary,
      ProductPromotionSnapshot,
      ProductSyncRun,
    ]),
    AiModule,
  ],
  controllers: [ErpController],
  providers: [ErpService, ErpInsightsService, ErpSyncService, ErpProductSyncScheduler],
  exports: [ErpService, ErpSyncService],
})
export class ErpModule {}
