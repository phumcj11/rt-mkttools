import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ErpInsightsService } from './erp-insights.service';
import { ErpSyncService } from './erp-sync.service';
import { ErpService } from './erp.service';

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

@Controller('erp')
export class ErpController {
  constructor(
    private readonly erp: ErpService,
    private readonly insights: ErpInsightsService,
    private readonly sync: ErpSyncService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.erp.dashboardSummary();
  }

  @Get('sales-summary')
  salesSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    const r = defaultRange();
    return this.erp.salesSummary(from || r.from, to || r.to, this.toInt(branchId));
  }

  @Get('sales-by-branch')
  salesByBranch(@Query('from') from?: string, @Query('to') to?: string) {
    const r = defaultRange();
    return this.erp.salesByBranch(from || r.from, to || r.to);
  }

  @Get('top-products')
  topProducts(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    const r = defaultRange();
    return this.erp.topProducts(from || r.from, to || r.to, limit, this.toInt(branchId));
  }

  @Get('timeseries')
  timeseries(
    @Query('bucket') bucket?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    const r = defaultRange();
    const b = bucket === 'week' || bucket === 'month' ? bucket : 'day';
    return this.erp.timeseries(from || r.from, to || r.to, b, this.toInt(branchId));
  }

  @Get('branches')
  branches() {
    return this.erp.branches();
  }

  @Get('top-buyers')
  topBuyers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const r = defaultRange();
    return this.erp.topBuyers(from || r.from, to || r.to, limit);
  }

  @Get('promotions')
  promotions(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.erp.promotions(limit);
  }

  @Get('ai-insights')
  aiInsights(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.insights.analyze(user, days);
  }

  @Get('history')
  history(@Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number) {
    return this.sync.history(days);
  }

  @Get('alerts')
  alerts() {
    return this.sync.computeAlerts();
  }

  @Post('sync')
  @Roles('super_admin', 'admin')
  runSync(@Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number) {
    return this.sync.sync(days);
  }

  private toInt(v?: string): number | undefined {
    if (!v) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
}
