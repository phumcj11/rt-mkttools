import { PlanCode } from '../../database/entities';

export type PlanFeature =
  | 'ai_content'
  | 'analytics'
  | 'executive'
  | 'erp'
  | 'erp_sync'
  | 'audit'
  | 'multi_branch';

const PLAN_FEATURES: Record<PlanCode, PlanFeature[]> = {
  free: ['ai_content', 'analytics', 'executive'],
  pro: ['ai_content', 'analytics', 'executive', 'erp', 'multi_branch'],
  business: [
    'ai_content',
    'analytics',
    'executive',
    'erp',
    'erp_sync',
    'audit',
    'multi_branch',
  ],
};

export function planIncludesFeature(code: PlanCode, feature: PlanFeature): boolean {
  return PLAN_FEATURES[code]?.includes(feature) ?? false;
}

export function listPlanFeatures(code: PlanCode): PlanFeature[] {
  return PLAN_FEATURES[code] ?? [];
}
