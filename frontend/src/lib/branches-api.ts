import { apiRequest } from './api';
import type { Branch, BranchInput } from './types';

export function listBranches() {
  return apiRequest<Branch[]>('/branches');
}

export function createBranch(input: BranchInput) {
  return apiRequest<Branch>('/branches', { method: 'POST', body: input });
}

export function updateBranch(id: number, input: Partial<BranchInput>) {
  return apiRequest<Branch>(`/branches/${id}`, { method: 'PATCH', body: input });
}

export function deleteBranch(id: number) {
  return apiRequest<{ message: string }>(`/branches/${id}`, { method: 'DELETE' });
}
