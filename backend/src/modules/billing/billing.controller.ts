import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { BillingService } from './billing.service';
import { ChangePlanDto } from './dto/change-plan.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Get('plans')
  listPlans() {
    return this.billingService.listPlans();
  }

  @Get('subscription')
  getSubscription(@CurrentUser() user: AuthUser) {
    return this.billingService.getSubscription(user.tenantId);
  }

  @Patch('subscription')
  @Roles('owner', 'admin')
  changePlan(@CurrentUser() user: AuthUser, @Body() dto: ChangePlanDto) {
    return this.billingService.changePlan(user.tenantId, dto.planCode);
  }

  @Get('invoices')
  listInvoices(@CurrentUser() user: AuthUser) {
    return this.billingService.listInvoices(user.tenantId);
  }
}
