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
  CreateStorefrontActivityDto,
  UpdateActiveBranchesDto,
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

  @Get('branch-daily-sales')
  branchDailySales(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('force') force?: string,
  ) {
    return this.revenue.branchDailySales(from, to, isForce(force));
  }

  @Get('country-analytics')
  countryAnalytics(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('country') country?: string,
    @Query('force') force?: string,
  ) {
    return this.revenue.countryAnalytics(user.tenantId, from, to, country ?? 'Thailand', isForce(force));
  }

  @Get('branch-country-analytics')
  branchCountryAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @Query('force') force?: string,
  ) {
    const bid = branchId ? parseInt(branchId, 10) : undefined;
    return this.revenue.branchCountryAnalytics(from, to, bid, isForce(force));
  }

  @Get('branch-country-products')
  branchCountryProducts(
    @Query('branchId') branchId: string,
    @Query('country') country: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('force') force?: string,
  ) {
    return this.revenue.branchCountryProducts(
      parseInt(branchId, 10),
      country,
      from,
      to,
      isForce(force),
    );
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

  @Get('active-branches')
  getActiveBranches() {
    return this.revenue.getActiveBranchCodes();
  }

  @Patch('active-branches')
  @Roles('super_admin', 'admin', 'marketing_manager')
  updateActiveBranches(@Body() dto: UpdateActiveBranchesDto) {
    return this.revenue.setActiveBranchCodes(dto.codes);
  }

  @Get('storefront-activities')
  listStorefrontActivities(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    const bid = branchId ? parseInt(branchId, 10) : undefined;
    return this.revenue.listStorefrontActivities(user.tenantId, from, to, bid);
  }

  @Get('storefront-activities/summary')
  storefrontActivitySummary(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.revenue.storefrontActivitySummary(user.tenantId, from, to);
  }

  @Post('storefront-activities')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff', 'branch_manager')
  createStorefrontActivity(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStorefrontActivityDto,
  ) {
    return this.revenue.createStorefrontActivity(user.tenantId, user.id, dto);
  }
}
