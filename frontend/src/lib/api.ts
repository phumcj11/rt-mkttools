import { useAuthStore } from '@/stores/auth-store';
import type { ApiErrorBody, AuthResult } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(body: ApiErrorBody | null, status: number) {
    super(body?.message ?? 'Request failed');
    this.code = body?.code ?? 'errors.generic';
    this.status = status;
    this.details = body?.details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  locale?: string;
}

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', body, auth = true, locale } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (locale) headers['x-locale'] = locale;
  if (auth) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError({ code: 'errors.network', message: 'Network error' }, 0);
  }

  const json = await res.json().catch(() => null);

  if (res.ok) {
    return (json?.data ?? null) as T;
  }
  throw new ApiError(json?.error ?? null, res.status);
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return false;

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const result = await rawRequest<AuthResult>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken },
          auth: false,
        });
        setTokens(result.tokens);
        return true;
      } catch {
        clear();
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && options.auth !== false) {
      const ok = await tryRefresh();
      if (ok) return rawRequest<T>(path, options);
    }
    throw err;
  }
}
