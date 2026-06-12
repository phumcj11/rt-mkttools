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

export interface GoogleConnectionStatus {
  credentialsConfigured: boolean;
  connected: boolean;
  locationName: string | null;
  locationTitle: string | null;
  tokenExpiresAt: string | null;
}

export interface GbpLocation {
  name: string;
  title: string;
  accountName: string;
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

// ─── Google Business Profile ────────────────────────────────────────────────

export function getGoogleStatus() {
  return apiRequest<GoogleConnectionStatus>('/reviews/google/status');
}

export function getGoogleAuthUrl() {
  return apiRequest<{ url: string }>('/reviews/google/auth-url');
}

export function getGoogleLocations() {
  return apiRequest<GbpLocation[]>('/reviews/google/locations');
}

export function selectGoogleLocation(name: string, title: string) {
  return apiRequest<{ ok: boolean }>('/reviews/google/select', {
    method: 'POST',
    body: { name, title },
  });
}

export function syncGoogleReviews() {
  return apiRequest<{ synced: number; errors: number }>('/reviews/google/sync', {
    method: 'POST',
  });
}

export function disconnectGoogle() {
  return apiRequest<{ ok: boolean }>('/reviews/google/disconnect', { method: 'POST' });
}

// ─── System settings for Google credentials ────────────────────────────────

export function getGoogleSettings() {
  return apiRequest<{ google_configured: boolean; google_client_id_preview: string | null }>(
    '/settings/system/google',
  );
}

export function saveGoogleCredentials(clientId: string, clientSecret: string) {
  return apiRequest<{ ok: boolean }>('/settings/system/google', {
    method: 'PATCH',
    body: { google_client_id: clientId, google_client_secret: clientSecret },
  });
}
