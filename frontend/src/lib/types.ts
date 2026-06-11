export type RoleName = 'owner' | 'admin' | 'editor' | 'viewer';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string | null;
  locale: string;
  tenantId: number;
  roles: RoleName[];
}

export interface TenantSummary {
  id: number;
  name: string;
  slug: string;
  locale: string;
}

export interface AuthTokens {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResult {
  user: AuthUser;
  tenant: TenantSummary | null;
  tokens: AuthTokens;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}
