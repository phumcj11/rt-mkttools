import { apiRequest } from './api';
import type {
  CampaignAnalysisSummary,
  ErpAlert,
  ErpBranchSales,
  ErpCacheStatus,
  ErpCampaignCacheItem,
  ErpCampaignCandidate,
  ErpCampaignResult,
  ErpCategoryPerformance,
  ErpDashboard,
  ErpInsights,
  ErpProductDetail,
  ErpProductListItem,
  ErpPromotion,
  ErpSalesSummary,
  ErpSyncResult,
  ErpTopProduct,
  SkuPromotionLookupResult,
  SkuPromotionStep,
} from './types';

export type { ErpCampaignCacheItem, SkuPromotionLookupResult, SkuPromotionStep };

export type {
  CampaignAnalysisSummary,
  ErpCacheStatus,
  ErpCampaignCandidate,
  ErpCampaignResult,
  ErpProductDetail,
};

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

export interface ErpProductsOpts {
  search?: string;
  category?: number;
  abc?: string;
  hasStock?: boolean;
  page?: number;
  limit?: number;
}

export function getErpProducts(opts?: ErpProductsOpts) {
  const p = new URLSearchParams();
  if (opts?.search)               p.set('search', opts.search);
  if (opts?.category !== undefined) p.set('category', String(opts.category));
  if (opts?.abc)                  p.set('abc', opts.abc);
  if (opts?.hasStock !== undefined) p.set('hasStock', opts.hasStock ? '1' : '0');
  if (opts?.page)                 p.set('page', String(opts.page));
  if (opts?.limit)                p.set('limit', String(opts.limit));
  return apiRequest<ErpProductListItem[]>(`/erp/products?${p.toString()}`);
}

export interface ErpCampaignCandidatesOpts extends ErpRangeOpts {
  targetPrice?: number;
  minGpPct?: number;
  pieceQty?: number;
  campaignName?: string;
  category?: number;
  abc?: string;
  limit?: number;
  withAi?: boolean;
}

export function getErpCampaignCandidates(opts?: ErpCampaignCandidatesOpts) {
  const p = new URLSearchParams();
  if (opts?.targetPrice !== undefined) p.set('targetPrice', String(opts.targetPrice));
  if (opts?.minGpPct !== undefined)    p.set('minGpPct', String(opts.minGpPct));
  if (opts?.pieceQty !== undefined)    p.set('pieceQty', String(opts.pieceQty));
  if (opts?.from)                      p.set('from', opts.from);
  if (opts?.to)                        p.set('to', opts.to);
  if (opts?.campaignName)              p.set('campaignName', opts.campaignName);
  if (opts?.category !== undefined)    p.set('category', String(opts.category));
  if (opts?.abc)                       p.set('abc', opts.abc);
  if (opts?.limit)                     p.set('limit', String(opts.limit));
  if (opts?.withAi)                    p.set('withAi', '1');
  return apiRequest<ErpCampaignResult>(`/erp/campaign-candidates?${p.toString()}`);
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

export function getErpSyncStatus() {
  return apiRequest<ErpCacheStatus>('/erp/sync/status');
}

export function syncErpProducts() {
  return apiRequest<{ synced: number }>('/erp/sync/products', { method: 'POST' });
}

export function syncErpSales(days = 90) {
  return apiRequest<ErpSyncResult>(`/erp/sync/sales?days=${days}`, { method: 'POST' });
}

export function getErpProductDetail(sku: string) {
  return apiRequest<ErpProductDetail>(`/erp/products/${encodeURIComponent(sku)}/detail`);
}

export function getCachedCampaigns(activeOnly = true) {
  return apiRequest<ErpCampaignCacheItem[]>(`/erp/promotions/cached?active=${activeOnly ? '1' : '0'}`);
}

export function getCachedCampaignDetail(id: number) {
  return apiRequest<ErpCampaignCacheItem>(`/erp/promotions/cached/${id}`);
}

export function getSkuPromotionSteps(sku: string) {
  return apiRequest<SkuPromotionLookupResult>(`/erp/promotions/sku/${encodeURIComponent(sku)}`);
}

export function syncErpCampaigns() {
  return apiRequest<{ synced: number; failed: number }>('/erp/sync/campaigns', { method: 'POST' });
}

export function forceSyncSkuPromotion(sku: string) {
  return apiRequest<{ synced: number }>(`/erp/promotions/sku/${encodeURIComponent(sku)}/sync`, { method: 'POST' });
}
