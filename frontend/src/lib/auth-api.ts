import { apiRequest } from './api';
import type { AuthResult, AuthUser } from './types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  shopName: string;
  fullName?: string;
  email: string;
  password: string;
}

export function login(input: LoginInput, locale?: string) {
  return apiRequest<AuthResult>('/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
    locale,
  });
}

export function register(input: RegisterInput, locale?: string) {
  return apiRequest<AuthResult>('/auth/register', {
    method: 'POST',
    body: input,
    auth: false,
    locale,
  });
}

export function fetchMe() {
  return apiRequest<AuthUser>('/auth/me');
}

export function logout(refreshToken: string) {
  return apiRequest<{ message: string }>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
  });
}
