import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BranchCustomerMixDaily,
  BranchStorefrontActivity,
  BranchTrafficDaily,
  ErpProductCache,
  ErpSalesSummary,
  SalesTarget,
} from '../../database/entities';
import { AiModule } from '../ai/ai.module';
import { ErpModule } from '../erp/erp.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';

@Module({
  imports: [
    AiModule,
    ErpModule,
    SystemSettingsModule,
    TypeOrmModule.forFeature([
      SalesTarget,
      BranchTrafficDaily,
      BranchCustomerMixDaily,
      BranchStorefrontActivity,
      ErpProductCache,
      ErpSalesSummary,
    ]),
  ],
  controllers: [RevenueController],
  providers: [RevenueService],
  exports: [RevenueService],
})
export class RevenueModule {}
