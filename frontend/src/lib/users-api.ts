import { apiRequest } from './api';

export interface UserItem {
  id: number;
  email: string;
  fullName: string | null;
  roles: string[];
  status: string;
  lastLoginAt: string | null;
  branchId: number | null;
  locale: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName?: string;
  roles: string[];
  branchId?: number;
}

export interface UpdateUserInput {
  fullName?: string;
  roles?: string[];
  status?: string;
  branchId?: number | null;
}

export function listUsers() {
  return apiRequest<UserItem[]>('/users');
}

export function getUser(id: number) {
  return apiRequest<UserItem>(`/users/${id}`);
}

export function createUser(input: CreateUserInput) {
  return apiRequest<UserItem>('/users', { method: 'POST', body: input });
}

export function updateUser(id: number, input: UpdateUserInput) {
  return apiRequest<UserItem>(`/users/${id}`, { method: 'PATCH', body: input });
}

export function deleteUser(id: number) {
  return apiRequest<{ message: string }>(`/users/${id}`, { method: 'DELETE' });
}
