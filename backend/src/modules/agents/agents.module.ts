import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgent, AiTask } from '../../database/entities';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiAgent, AiTask])],
  controllers: [AgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}
