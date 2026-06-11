import { apiRequest } from './api';
import type { Campaign, CampaignInput, Promotion, PromotionInput } from './types';

export function listCampaigns() {
  return apiRequest<Campaign[]>('/campaigns');
}

export function createCampaign(input: CampaignInput) {
  return apiRequest<Campaign>('/campaigns', { method: 'POST', body: input });
}

export function updateCampaign(id: number, input: Partial<CampaignInput>) {
  return apiRequest<Campaign>(`/campaigns/${id}`, { method: 'PATCH', body: input });
}

export function deleteCampaign(id: number) {
  return apiRequest<{ message: string }>(`/campaigns/${id}`, { method: 'DELETE' });
}

export function listPromotions(campaignId?: number) {
  const query = campaignId ? `?campaignId=${campaignId}` : '';
  return apiRequest<Promotion[]>(`/promotions${query}`);
}

export function createPromotion(input: PromotionInput) {
  return apiRequest<Promotion>('/promotions', { method: 'POST', body: input });
}

export function deletePromotion(id: number) {
  return apiRequest<{ message: string }>(`/promotions/${id}`, { method: 'DELETE' });
}
