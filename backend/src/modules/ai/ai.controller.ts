import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AiService } from './ai.service';
import { GenerateContentDto } from './dto/generate-content.dto';
import { GenerateBatchDto } from './dto/generate-batch.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('templates')
  getTemplates() {
    return this.aiService.getTemplates();
  }

  @Get('usage')
  getUsage(@CurrentUser() user: AuthUser) {
    return this.aiService.getUsage(user.tenantId);
  }

  @Post('generate')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateContentDto) {
    return this.aiService.generate(user.tenantId, user.id, dto);
  }

  @Post('generate-batch')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  generateBatch(@CurrentUser() user: AuthUser, @Body() dto: GenerateBatchDto) {
    return this.aiService.generateBatch(user.tenantId, user.id, dto);
  }
}
