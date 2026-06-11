import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_KEY } from '../decorators/requires-feature.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';
import { BillingService } from '../../modules/billing/billing.service';
import { PlanFeature } from '../../modules/billing/plan-features';

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billing: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeature>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (!user?.tenantId) return true;

    await this.billing.assertFeature(user.tenantId, feature);
    return true;
  }
}
