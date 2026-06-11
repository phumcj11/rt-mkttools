import { apiRequest } from './api';
import type {
  AnalyticsSummary,
  CampaignStatusCount,
  SalesPoint,
  SalesRecordItem,
  TopProduct,
} from './types';

export function getAnalyticsSummary(days = 30) {
  return apiRequest<AnalyticsSummary>(`/analytics/summary?days=${days}`);
}

export function getSalesSeries(days = 30) {
  return apiRequest<SalesPoint[]>(`/analytics/sales-series?days=${days}`);
}

export function getTopProducts(days = 30, limit = 5) {
  return apiRequest<TopProduct[]>(`/analytics/top-products?days=${days}&limit=${limit}`);
}

export function getCampaignStatus() {
  return apiRequest<CampaignStatusCount[]>('/analytics/campaign-status');
}

export function listSalesRecords(days = 30) {
  return apiRequest<SalesRecordItem[]>(`/analytics/sales?days=${days}`);
}

export function generateSampleSales() {
  return apiRequest<{ created: number }>('/analytics/sample', { method: 'POST' });
}
