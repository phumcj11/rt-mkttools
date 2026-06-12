import { apiRequest } from './api';
import type {
  ErpAlert,
  ErpBranchSales,
  ErpCategoryPerformance,
  ErpDashboard,
  ErpInsights,
  ErpPromotion,
  ErpSalesSummary,
  ErpSyncResult,
  ErpTopProduct,
} from './types';

export interface ErpRangeOpts {
  from?: string;
  to?: string;
  force?: boolean;
}

function rangeParams(days: number, opts?: ErpRangeOpts): string {
  const f = opts?.force ? '&force=true' : '';
  if (opts?.from && opts?.to) return `from=${opts.from}&to=${opts.to}${f}`;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `from=${fmt(from)}&to=${fmt(to)}${f}`;
}

export function getErpDashboard(force = false) {
  return apiRequest<ErpDashboard>(`/erp/dashboard${force ? '?force=true' : ''}`);
}

export function getErpSalesSummary(days = 30, opts?: ErpRangeOpts) {
  return apiRequest<ErpSalesSummary>(`/erp/sales-summary?${rangeParams(days, opts)}`);
}

export function getErpSalesByBranch(days = 30, opts?: ErpRangeOpts) {
  return apiRequest<ErpBranchSales[]>(`/erp/sales-by-branch?${rangeParams(days, opts)}`);
}

export function getErpTopProducts(days = 30, limit = 10, opts?: ErpRangeOpts) {
  return apiRequest<ErpTopProduct[]>(`/erp/top-products?${rangeParams(days, opts)}&limit=${limit}`);
}

export function getErpPromotions(limit = 50, force = false) {
  return apiRequest<ErpPromotion[]>(`/erp/promotions?limit=${limit}${force ? '&force=true' : ''}`);
}

export function getErpCategoryPerformance(days = 30, opts?: ErpRangeOpts) {
  return apiRequest<ErpCategoryPerformance[]>(`/erp/category-performance?${rangeParams(days, opts)}`);
}

export function getErpAiInsights(days = 30, force = false) {
  return apiRequest<ErpInsights>(`/erp/ai-insights?days=${days}${force ? '&force=true' : ''}`);
}

export function getErpAlerts() {
  return apiRequest<ErpAlert[]>('/erp/alerts');
}

export function syncErp(days = 90) {
  return apiRequest<ErpSyncResult>(`/erp/sync?days=${days}`, { method: 'POST' });
}
