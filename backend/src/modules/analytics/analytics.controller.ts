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
  ) {
    return this.analytics.summary(user.tenantId, days);
  }

  @Get('sales-series')
  salesSeries(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analytics.salesSeries(user.tenantId, days);
  }

  @Get('top-products')
  topProducts(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.analytics.topProducts(user.tenantId, days, limit);
  }

  @Get('campaign-status')
  campaignStatus(@CurrentUser() user: AuthUser) {
    return this.analytics.campaignStatus(user.tenantId);
  }

  @Get('sales')
  listSales(
    @CurrentUser() user: AuthUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analytics.listSales(user.tenantId, days);
  }

  @Post('sales')
  @Roles('owner', 'admin', 'editor')
  recordSale(@CurrentUser() user: AuthUser, @Body() dto: RecordSaleDto) {
    return this.analytics.recordSale(user.tenantId, dto);
  }

  @Post('sample')
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.OK)
  generateSample(@CurrentUser() user: AuthUser) {
    return this.analytics.generateSample(user.tenantId);
  }
}
