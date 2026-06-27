import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BranchCustomerMixDaily,
  BranchStorefrontActivity,
  BranchTrafficDaily,
  ErpProductCache,
  ErpSalesSummary,
  PosImportRun,
  PosSalesLine,
  SalesTarget,
} from '../../database/entities';
import { AiModule } from '../ai/ai.module';
import { ErpModule } from '../erp/erp.module';
import { MediaModule } from '../media/media.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { PosSalesImportService } from './pos-sales-import.service';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';

@Module({
  imports: [
    AiModule,
    ErpModule,
    MediaModule,
    SystemSettingsModule,
    TypeOrmModule.forFeature([
      SalesTarget,
      BranchTrafficDaily,
      BranchCustomerMixDaily,
      BranchStorefrontActivity,
      ErpProductCache,
      ErpSalesSummary,
      PosImportRun,
      PosSalesLine,
    ]),
  ],
  controllers: [RevenueController],
  providers: [RevenueService, PosSalesImportService],
  exports: [RevenueService],
})
export class RevenueModule {}
