import { apiRequest } from './api';

export interface PosmProject {
  id: number;
  type: string;
  productName: string;
  price: number | null;
  promotion: string | null;
  outputUrl: string | null;
  status: 'pending' | 'done' | 'error';
  createdAt: string;
}

export interface GeneratePosmResult extends PosmProject {
  headline: string | null;
}

export interface CreatePosmDto {
  type: string;
  productName: string;
  price?: number;
  promotion?: string;
}

export function generatePosm(dto: CreatePosmDto) {
  return apiRequest<GeneratePosmResult>('/posm', { method: 'POST', body: dto });
}

export function listPosm() {
  return apiRequest<PosmProject[]>('/posm');
}

export function deletePosm(id: number) {
  return apiRequest<{ message: string }>(`/posm/${id}`, { method: 'DELETE' });
}
