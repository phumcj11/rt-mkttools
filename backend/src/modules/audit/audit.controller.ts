import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresFeature } from '../../common/decorators/requires-feature.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuditService } from './audit.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('owner', 'admin')
  @RequiresFeature('audit')
  list(
    @CurrentUser() user: AuthUser,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('action') action?: string,
  ) {
    return this.auditService.list(user.tenantId, limit, action || undefined);
  }
}
