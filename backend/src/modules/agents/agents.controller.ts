import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, Post, Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.agentsService.getStats(user.tenantId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.agentsService.findAll(user.tenantId);
  }

  @Post()
  @Roles('super_admin', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAgentDto) {
    return this.agentsService.create(user.tenantId, dto);
  }

  @Post(':id/run')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'admin', 'marketing_manager')
  run(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.agentsService.runAgent(user.tenantId, id);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'admin', 'marketing_manager')
  stop(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.agentsService.stopAgent(user.tenantId, id);
  }

  @Get('tasks')
  findTasks(@CurrentUser() user: AuthUser, @Query('agentId') agentId?: string) {
    return this.agentsService.findTasks(user.tenantId, agentId ? Number(agentId) : undefined);
  }
}
