import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosmProject } from '../../database/entities';
import { AiModule } from '../ai/ai.module';
import { PosmController } from './posm.controller';
import { PosmService } from './posm.service';

@Module({
  imports: [TypeOrmModule.forFeature([PosmProject]), AiModule],
  controllers: [PosmController],
  providers: [PosmService],
})
export class PosmModule {}
