/** Resolve public API base URL (no trailing slash), e.g. https://rt.k-mkt.com/api */
export function getApiBaseUrl(): string {
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL.replace(/\/$/, '');
  }

  const apiPrefix = process.env.API_PREFIX ?? 'api';
  const publicApp = process.env.NEXT_PUBLIC_APP_URL ?? process.env.FRONTEND_URL;
  if (publicApp?.startsWith('http')) {
    return `${publicApp.replace(/\/$/, '')}/${apiPrefix}`;
  }

  const corsOrigin = process.env.CORS_ORIGINS?.split(',')[0]?.trim();
  if (corsOrigin?.startsWith('http')) {
    return `${corsOrigin.replace(/\/$/, '')}/${apiPrefix}`;
  }

  const port = process.env.BACKEND_PORT ?? '4000';
  return `http://localhost:${port}/${apiPrefix}`;
}

/** Resolve frontend base URL (no trailing slash), e.g. https://rt.k-mkt.com */
export function getFrontendBaseUrl(): string {
  const url =
    process.env.FRONTEND_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.CORS_ORIGINS?.split(',')[0]?.trim() ??
    'http://localhost:3000';
  return url.replace(/\/$/, '');
}

/** Google OAuth redirect URI — must match Google Cloud Console exactly */
export function getGoogleOAuthRedirectUri(): string {
  return `${getApiBaseUrl()}/reviews/google/callback`;
}
