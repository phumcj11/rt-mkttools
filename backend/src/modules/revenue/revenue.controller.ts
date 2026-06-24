import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import {
  BulkUpsertCustomerMixDto,
  BulkUpsertTargetsDto,
  BulkUpsertTrafficDto,
} from './dto/revenue.dto';
import { RevenueService } from './revenue.service';

const isForce = (v?: string) => v === 'true' || v === '1';

@Controller('revenue')
export class RevenueController {
  constructor(private readonly revenue: RevenueService) {}

  @Get('command-center')
  commandCenter(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('force') force?: string,
  ) {
    return this.revenue.commandCenter(user.tenantId, from, to, isForce(force));
  }

  @Get('targets')
  listTargets(
    @CurrentUser() user: AuthUser,
    @Query('yearMonth') yearMonth?: string,
  ) {
    return this.revenue.listTargets(user.tenantId, yearMonth);
  }

  @Patch('targets')
  @Roles('super_admin', 'admin', 'marketing_manager')
  upsertTargets(@CurrentUser() user: AuthUser, @Body() dto: BulkUpsertTargetsDto) {
    return this.revenue.upsertTargets(user.tenantId, dto);
  }

  @Get('traffic')
  listTraffic(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    const bid = branchId ? parseInt(branchId, 10) : undefined;
    return this.revenue.listTraffic(user.tenantId, from, to, bid);
  }

  @Post('traffic')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  upsertTraffic(@CurrentUser() user: AuthUser, @Body() dto: BulkUpsertTrafficDto) {
    return this.revenue.upsertTraffic(user.tenantId, dto);
  }

  @Get('customer-mix')
  listCustomerMix(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    const bid = branchId ? parseInt(branchId, 10) : undefined;
    return this.revenue.listCustomerMix(user.tenantId, from, to, bid);
  }

  @Post('customer-mix')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  upsertCustomerMix(@CurrentUser() user: AuthUser, @Body() dto: BulkUpsertCustomerMixDto) {
    return this.revenue.upsertCustomerMix(user.tenantId, dto);
  }
}
