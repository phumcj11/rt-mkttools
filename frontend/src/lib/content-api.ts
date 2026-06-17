import { apiRequest } from './api';
import type { ContentItem } from './types';

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
