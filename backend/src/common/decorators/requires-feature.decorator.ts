import { SetMetadata } from '@nestjs/common';
import { PlanFeature } from '../../modules/billing/plan-features';

export const FEATURE_KEY = 'plan_feature';

export const RequiresFeature = (feature: PlanFeature) => SetMetadata(FEATURE_KEY, feature);
