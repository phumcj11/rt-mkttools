import { apiRequest } from './api';
import type { ContentItem } from './types';

export interface SaveContentInput {
  type: string;
  title?: string;
  body: string;
  channel?: string;
  locale?: string;
  aiRequestId?: number;
}

export function listContent() {
  return apiRequest<ContentItem[]>('/content');
}

export function saveContent(input: SaveContentInput) {
  return apiRequest<ContentItem>('/content', { method: 'POST', body: input });
}

export function deleteContent(id: number) {
  return apiRequest<{ message: string }>(`/content/${id}`, { method: 'DELETE' });
}
