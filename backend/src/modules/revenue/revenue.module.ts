import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BranchCustomerMixDaily,
  BranchTrafficDaily,
  ErpProductCache,
  ErpSalesSummary,
  SalesTarget,
} from '../../database/entities';
import { ErpModule } from '../erp/erp.module';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';

@Module({
  imports: [
    ErpModule,
    TypeOrmModule.forFeature([
      SalesTarget,
      BranchTrafficDaily,
      BranchCustomerMixDaily,
      ErpProductCache,
      ErpSalesSummary,
    ]),
  ],
  controllers: [RevenueController],
  providers: [RevenueService],
  exports: [RevenueService],
})
export class RevenueModule {}
