import { apiRequest } from './api';

export interface GoogleReview {
  id: number;
  branchId: number | null;
  author: string | null;
  rating: number;
  text: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  aiReply: string | null;
  repliedAt: string | null;
  reviewDate: string | null;
  createdAt: string;
}

export interface ReviewStats {
  total: number;
  avgRating: number;
  negative: number;
  unreplied: number;
}

export function listReviews(branchId?: number) {
  const q = branchId ? `?branchId=${branchId}` : '';
  return apiRequest<GoogleReview[]>(`/reviews${q}`);
}

export function getReviewStats() {
  return apiRequest<ReviewStats>('/reviews/stats');
}

export function createReview(dto: Partial<GoogleReview> & { rating: number }) {
  return apiRequest<GoogleReview>('/reviews', { method: 'POST', body: dto });
}

export function generateReply(id: number) {
  return apiRequest<{ aiReply: string }>(`/reviews/${id}/generate-reply`, { method: 'POST' });
}

export function markReplied(id: number) {
  return apiRequest<GoogleReview>(`/reviews/${id}/mark-replied`, { method: 'POST' });
}

export function deleteReview(id: number) {
  return apiRequest<{ message: string }>(`/reviews/${id}`, { method: 'DELETE' });
}
