import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.tenantsService.findById(user.tenantId);
  }

  @Patch('me')
  @Roles('owner', 'admin')
  updateMine(@CurrentUser() user: AuthUser, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(user.tenantId, dto);
  }
}
