import { apiRequest } from './api';
import type {
  AnalyticsSummary,
  BranchSalesPoint,
  CampaignStatusCount,
  CategorySalesPoint,
  ExecutiveSummary,
  SalesPoint,
  SalesRecordItem,
  TopProduct,
} from './types';

function branchQuery(branchId?: number | null): string {
  return branchId ? `&branchId=${branchId}` : '';
}

export function getAnalyticsSummary(days = 30, branchId?: number | null) {
  return apiRequest<AnalyticsSummary>(`/analytics/summary?days=${days}${branchQuery(branchId)}`);
}

export function getSalesSeries(days = 30, branchId?: number | null) {
  return apiRequest<SalesPoint[]>(`/analytics/sales-series?days=${days}${branchQuery(branchId)}`);
}

export function getTopProducts(days = 30, limit = 5, branchId?: number | null) {
  return apiRequest<TopProduct[]>(
    `/analytics/top-products?days=${days}&limit=${limit}${branchQuery(branchId)}`,
  );
}

export function getCampaignStatus() {
  return apiRequest<CampaignStatusCount[]>('/analytics/campaign-status');
}

export function getSalesByBranch(days = 30) {
  return apiRequest<BranchSalesPoint[]>(`/analytics/sales-by-branch?days=${days}`);
}

export function getSalesByCategory(days = 30) {
  return apiRequest<CategorySalesPoint[]>(`/analytics/sales-by-category?days=${days}`);
}

export function getExecutiveSummary(days = 30) {
  return apiRequest<ExecutiveSummary>(`/analytics/executive?days=${days}`);
}

export function listSalesRecords(days = 30, branchId?: number | null) {
  return apiRequest<SalesRecordItem[]>(`/analytics/sales?days=${days}${branchQuery(branchId)}`);
}

export function generateSampleSales() {
  return apiRequest<{ created: number }>('/analytics/sample', { method: 'POST' });
}
