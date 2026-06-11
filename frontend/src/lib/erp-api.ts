import { apiRequest } from './api';
import type {
  ErpAlert,
  ErpBranchSales,
  ErpDashboard,
  ErpInsights,
  ErpPromotion,
  ErpSalesSummary,
  ErpSyncResult,
  ErpTopProduct,
} from './types';

function range(days: number): string {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `from=${fmt(from)}&to=${fmt(to)}`;
}

export function getErpDashboard() {
  return apiRequest<ErpDashboard>('/erp/dashboard');
}

export function getErpSalesSummary(days = 30) {
  return apiRequest<ErpSalesSummary>(`/erp/sales-summary?${range(days)}`);
}

export function getErpSalesByBranch(days = 30) {
  return apiRequest<ErpBranchSales[]>(`/erp/sales-by-branch?${range(days)}`);
}

export function getErpTopProducts(days = 30, limit = 10) {
  return apiRequest<ErpTopProduct[]>(`/erp/top-products?${range(days)}&limit=${limit}`);
}

export function getErpPromotions(limit = 12) {
  return apiRequest<ErpPromotion[]>(`/erp/promotions?limit=${limit}`);
}

export function getErpAiInsights(days = 30) {
  return apiRequest<ErpInsights>(`/erp/ai-insights?days=${days}`);
}

export function getErpAlerts() {
  return apiRequest<ErpAlert[]>('/erp/alerts');
}

export function syncErp(days = 90) {
  return apiRequest<ErpSyncResult>(`/erp/sync?days=${days}`, { method: 'POST' });
}
