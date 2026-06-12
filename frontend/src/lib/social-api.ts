import { apiRequest } from './api';

export interface SocialMention {
  id: number;
  platform: string;
  keyword: string;
  authorHandle: string | null;
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  isViral: boolean;
  sourceUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface ListeningKeyword {
  id: number;
  keyword: string;
  isActive: boolean;
  createdAt: string;
}

export interface MentionStats {
  total: number;
  positive: number;
  negative: number;
  viral: number;
}

export function getMentionStats() {
  return apiRequest<MentionStats>('/social/stats');
}

export function listMentions(limit = 100) {
  return apiRequest<SocialMention[]>(`/social/mentions?limit=${limit}`);
}

export function listKeywords() {
  return apiRequest<ListeningKeyword[]>('/social/keywords');
}

export function createKeyword(keyword: string) {
  return apiRequest<ListeningKeyword>('/social/keywords', { method: 'POST', body: { keyword } });
}

export function deleteKeyword(id: number) {
  return apiRequest<{ message: string }>(`/social/keywords/${id}`, { method: 'DELETE' });
}

export function deleteMention(id: number) {
  return apiRequest<{ message: string }>(`/social/mentions/${id}`, { method: 'DELETE' });
}
