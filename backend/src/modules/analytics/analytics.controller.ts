import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AnalyticsService } from './analytics.service';
import { RecordSaleDto } from './dto/record-sale.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('branchId') branchId?: string,
  ) {
    return this.analytics.summary(user.tenantId, days, this.parseBranch(branchId));
  }

  @Get('sales-series')
  salesSeries(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('branchId') branchId?: string,
  ) {
    return this.analytics.salesSeries(user.tenantId, days, this.parseBranch(branchId));
  }

  @Get('top-products')
  topProducts(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Query('branchId') branchId?: string,
  ) {
    return this.analytics.topProducts(user.tenantId, days, limit, this.parseBranch(branchId));
  }

  @Get('campaign-status')
  campaignStatus(@CurrentUser() user: AuthUser) {
    return this.analytics.campaignStatus(user.tenantId);
  }

  @Get('sales-by-branch')
  salesByBranch(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analytics.salesByBranch(user.tenantId, days);
  }

  @Get('sales-by-category')
  salesByCategory(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analytics.salesByCategory(user.tenantId, days);
  }

  @Get('executive')
  executive(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analytics.executiveSummary(user.tenantId, days);
  }

  @Get('sales')
  listSales(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('branchId') branchId?: string,
  ) {
    return this.analytics.listSales(user.tenantId, days, this.parseBranch(branchId));
  }

  @Post('sales')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  recordSale(@CurrentUser() user: AuthUser, @Body() dto: RecordSaleDto) {
    return this.analytics.recordSale(user.tenantId, dto);
  }

  @Post('sample')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  generateSample(@CurrentUser() user: AuthUser) {
    return this.analytics.generateSample(user.tenantId);
  }

  private parseBranch(branchId?: string): number | undefined {
    if (branchId === undefined || branchId === '' || branchId === 'all') return undefined;
    const n = Number(branchId);
    return Number.isNaN(n) ? undefined : n;
  }
}
