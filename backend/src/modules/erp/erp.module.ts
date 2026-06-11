import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpSalesDaily } from '../../database/entities';
import { AiModule } from '../ai/ai.module';
import { ErpInsightsService } from './erp-insights.service';
import { ErpSyncService } from './erp-sync.service';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpSalesDaily]), AiModule],
  controllers: [ErpController],
  providers: [ErpService, ErpInsightsService, ErpSyncService],
  exports: [ErpService],
})
export class ErpModule {}
