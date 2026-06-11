import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiRequest, AiTemplate, AiUsage } from '../../database/entities';
import { BillingModule } from '../billing/billing.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenAiService } from './openai.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiRequest, AiUsage, AiTemplate]), BillingModule],
  controllers: [AiController],
  providers: [AiService, OpenAiService],
  exports: [AiService, OpenAiService],
})
export class AiModule {}
