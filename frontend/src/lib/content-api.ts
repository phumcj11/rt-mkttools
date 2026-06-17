import { apiRequest } from './api';
import type { ContentAsset, ContentItem, ContentPublishJob } from './types';

export interface SaveContentInput {
  type: string;
  title?: string;
  body: string;
  channel?: string;
  locale?: string;
  aiRequestId?: number;
  sku?: string;
  campaignId?: number;
  campaignName?: string;
  productName?: string;
}

export function listContent() {
  return apiRequest<ContentItem[]>('/content');
}

export function saveContent(input: SaveContentInput) {
  return apiRequest<ContentItem>('/content', { method: 'POST', body: input });
}

export function updateContentStatus(id: number, status: string) {
  return apiRequest<ContentItem>(`/content/${id}/status`, { method: 'PATCH', body: { status } });
}

export function scheduleContent(id: number, scheduledAt: string) {
  return apiRequest<ContentItem>(`/content/${id}/schedule`, { method: 'PATCH', body: { scheduledAt } });
}

export function publishContentLine(id: number, lineUserId?: string) {
  return apiRequest<{ ok: boolean; mode: string; message: string; preview?: string }>(
    `/content/${id}/publish/line`,
    { method: 'POST', body: lineUserId ? { lineUserId } : {} },
  );
}

export function publishContentGbp(id: number) {
  return apiRequest<{ ok: boolean; mode: string; message: string; body?: string }>(
    `/content/${id}/publish/gbp`,
    { method: 'POST', body: {} },
  );
}

export function listContentAssets(contentId: number) {
  return apiRequest<ContentAsset[]>(`/content/${contentId}/assets`);
}

export function generateManusAsset(contentId: number, body: {
  sourceImageUrl?: string;
  prompt?: string;
  platform?: string;
}) {
  return apiRequest<ContentAsset>(`/content/${contentId}/assets/manus`, { method: 'POST', body });
}

export function refreshManusAsset(contentId: number, assetId: number) {
  return apiRequest<ContentAsset>(`/content/${contentId}/assets/${assetId}/refresh`, { method: 'POST' });
}

export function updateContentAssetStatus(contentId: number, assetId: number, status: 'approved' | 'rejected') {
  return apiRequest<ContentAsset>(`/content/${contentId}/assets/${assetId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function publishContentBlotato(contentId: number, body: {
  platform: string;
  assetId?: number;
  scheduledAt?: string;
}) {
  return apiRequest<ContentPublishJob>(`/content/${contentId}/publish/blotato`, { method: 'POST', body });
}

export function listContentPublishJobs(contentId: number) {
  return apiRequest<ContentPublishJob[]>(`/content/${contentId}/publish-jobs`);
}

export function refreshContentPublishJob(jobId: number) {
  return apiRequest<ContentPublishJob>(`/content/publish-jobs/${jobId}/refresh`, { method: 'POST' });
}

export function deleteContent(id: number) {
  return apiRequest<{ message: string }>(`/content/${id}`, { method: 'DELETE' });
}

/** Export library rows as CSV (client-side). */
export function exportContentCsv(items: ContentItem[]): string {
  const header = ['sku', 'product_name', 'type', 'channel', 'status', 'campaign_name', 'body', 'created_at'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = items.map((item) => [
    item.sku ?? '',
    item.productName ?? '',
    item.type,
    item.channel ?? '',
    item.status,
    item.campaignName ?? '',
    (item.body ?? '').replace(/\r?\n/g, ' '),
    item.createdAt,
  ].map(escape).join(','));
  return [header.join(','), ...rows].join('\n');
}
