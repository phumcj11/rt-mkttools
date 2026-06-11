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

export type GenerateContentType = 'caption' | 'post' | 'ad' | 'line_broadcast';
export type ContentTone = 'friendly' | 'fun' | 'professional' | 'urgent';

export interface ContentTemplate {
  key: GenerateContentType;
  labelTh: string;
  labelEn: string;
  descriptionTh: string;
  descriptionEn: string;
}

export interface GenerateInput {
  type: GenerateContentType;
  productName: string;
  price?: number;
  details?: string;
  tone?: ContentTone;
  locale?: string;
}

export interface GenerateResult {
  content: string;
  type: string;
  aiRequestId: number;
  tokens: { prompt: number; completion: number; total: number };
}

export interface UsageSummary {
  periodMonth: string;
  totalTokens: number;
  totalRequests: number;
  limit: number;
  remaining: number;
}

export interface ContentItem {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  channel: string | null;
  locale: string;
  status: string;
  aiRequestId: number | null;
  createdAt: string;
}

// ---------- Phase 4: marketing modules ----------

export type ProductStatus = 'active' | 'archived';

export interface Category {
  id: number;
  name: string;
  createdAt: string;
}

export interface Product {
  id: number;
  categoryId: number | null;
  sku: string | null;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  price: number;
  categoryId?: number | null;
  sku?: string;
  description?: string;
  imageUrl?: string;
  status?: ProductStatus;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'archived';

export interface Campaign {
  id: number;
  name: string;
  objective: string | null;
  channel: string | null;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignInput {
  name: string;
  objective?: string;
  channel?: string;
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
}

export type DiscountType = 'percent' | 'amount' | 'bundle';

export interface Promotion {
  id: number;
  campaignId: number | null;
  title: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface PromotionInput {
  title: string;
  campaignId?: number;
  discountType?: DiscountType;
  discountValue?: number;
  startDate?: string;
  endDate?: string;
}
