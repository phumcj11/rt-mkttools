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

export type GenerateContentType =
  | 'caption'
  | 'post'
  | 'ad'
  | 'line_broadcast'
  | 'fb_post'
  | 'tiktok_caption'
  | 'tiktok_script'
  | 'instagram'
  | 'gbp_post'
  | 'seo_article'
  | 'product_desc'
  | 'ugc_script'
  | 'rewrite'
  | 'translate'
  | 'hashtag';

export type ContentTone = 'friendly' | 'fun' | 'professional' | 'urgent';

export interface ContentTemplate {
  key: GenerateContentType;
  labelTh: string;
  labelEn: string;
  descriptionTh: string;
  descriptionEn: string;
  group?: 'social' | 'platform' | 'seo' | 'tools';
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

// ---------- Phase 5: realtime & notifications ----------

export type NotificationType = 'system' | 'campaign' | 'content' | 'ai' | 'product';

export interface Notification {
  id: number;
  tenantId: number;
  userId: number | null;
  type: NotificationType;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatThread {
  id: number;
  title: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  threadId: number;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatDonePayload {
  threadId: number;
  userMessageId: number;
  assistantMessageId: number;
  content: string;
  tokens: { prompt: number; completion: number; total: number };
}

// ---------- Phase 6: analytics ----------

export interface AnalyticsSummary {
  totalSales: number;
  totalOrders: number;
  totalQuantity: number;
  avgOrderValue: number;
  aiTokens: number;
  activeCampaigns: number;
  totalProducts: number;
  periodDays: number;
}

export interface SalesPoint {
  date: string;
  total: number;
  orders: number;
}

export interface TopProduct {
  productId: number;
  name: string;
  total: number;
  quantity: number;
}

export interface CampaignStatusCount {
  status: string;
  count: number;
}

export interface SalesRecordItem {
  id: number;
  branchId: number | null;
  productId: number | null;
  campaignId: number | null;
  amount: number;
  quantity: number;
  soldAt: string;
  createdAt: string;
}

// ---------- Phase 7: branches + executive dashboard ----------

export type BranchStatus = 'active' | 'inactive';

export interface Branch {
  id: number;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BranchInput {
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  status?: BranchStatus;
}

export interface BranchSalesPoint {
  branchId: number | null;
  name: string;
  total: number;
  orders: number;
}

export interface CategorySalesPoint {
  categoryId: number | null;
  name: string;
  total: number;
  quantity: number;
}

export interface ExecutiveSummary {
  current: { totalSales: number; totalOrders: number; aiTokens: number };
  previous: { totalSales: number; totalOrders: number };
  growth: { sales: number; orders: number };
  branchCount: number;
  topBranch: BranchSalesPoint | null;
  insights: string[];
  periodDays: number;
  kpis: {
    chatThreads: number;
    chatMessages: number;
    reviews: { count: number; avgRating: number | null; placeholder: boolean };
    social: { mentions: number; placeholder: boolean };
  };
}

export interface AuditLogItem {
  id: number;
  tenantId: number | null;
  userId: number | null;
  action: string;
  entity: string | null;
  entityId: number | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export type PlanCode = 'free' | 'pro' | 'business';

export interface PlanSummary {
  id: number;
  code: PlanCode;
  name: string;
  priceMonthly: number;
  aiTokenLimit: number;
  userLimit: number;
}

export interface SubscriptionSummary {
  id: number;
  status: string;
  startedAt: string;
  currentPeriodEnd: string | null;
  plan: PlanSummary;
  usage: {
    userCount: number;
    userLimit: number;
    aiTokensUsed: number;
    aiTokenLimit: number;
    aiRequests: number;
    periodMonth: string;
  };
}

export interface InvoiceItem {
  id: number;
  amount: number;
  currency: string;
  status: 'open' | 'paid' | 'void';
  paymentMethod?: 'manual' | 'bank_transfer' | 'promptpay' | null;
  paymentReference?: string | null;
  issuedAt: string;
  paidAt: string | null;
}

export type PaymentMethod = 'manual' | 'bank_transfer' | 'promptpay';

// ----- ERP integration (read-only, live from ChangSiam) -----

export interface ErpTrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface ErpDashboard {
  revenue: { today: number; week: number; month: number; year: number };
  ordersToday: number;
  counts: { products: number; branches: number; customers: number; suppliers: number };
  trend30: ErpTrendPoint[];
}

export interface ErpSalesSummary {
  orders: number;
  revenue: number;
  gross: number;
  discount: number;
  avgTicket: number;
}

export interface ErpBranchSales {
  id: number;
  code: string;
  name: string;
  shortcode: string;
  orders: number;
  revenue: number;
  avgTicket: number;
}

export interface ErpTopProduct {
  id: number;
  sku: string;
  name: string;
  category: string;
  brand: string;
  qtySold: number;
  revenue: number;
  gpBaht: number;
  gpPct: number;
  abcCompany: string;
  imageUrl: string;
}

export interface ErpPromotion {
  id: number;
  code: string;
  name: string;
  type: string;
  typeName: string;
  dateStart: string;
  dateStop: string;
  retailPrice: number;
  promoPrice: number;
  wholesalePrice: number;
  productCount: number;
  freeItemCount: number;
  discountPct: number;
  branch: number | null;
  branchName: string | null;
}

export interface ErpCategoryPerformance {
  category: string;
  revenue: number;
  qtySold: number;
  productCount: number;
  gpPct: number;
}

export interface ErpProductListItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  brand: string;
  abcCompany: string;
  costSales: number;
  retailPrice: number;
  imageUrl: string;
  productType: string;
}

export interface ErpCampaignCandidate {
  sku: string;
  productId: number;
  name: string;
  category: string;
  brand: string;
  imageUrl: string;
  /** Number of pieces in the bundle (e.g. 3 for "3 ชิ้น 100") */
  pieceQty: number;
  /** Target price per piece = targetPrice / pieceQty */
  perPieceTarget: number;
  gpPct: number;
  gpBaht: number;
  revenue: number;
  qtySold: number;
  abcCompany: string;
  retailPrice: number;
  costSales: number;
  /** Total cost for the bundle (costSales × pieceQty) */
  bundleCost: number;
  minSellPrice: number;
  campaignGpPct: number | null;
  /** max(campaignGpPct, historical gpPct) — used for eligibility */
  effectiveGpPct: number;
  eligibleForTarget: boolean;
  discountNeeded: number;
  dataQuality: string[];
  score: number;
  reasons: string[];
  warnings: string[];
  hasExistingPromo: boolean;
}

export interface CampaignAnalysisSummary {
  source: 'ai' | 'heuristic';
  insights: string[];
  text: string;
  generatedAt: string;
}

export interface ErpCampaignResult {
  candidates: ErpCampaignCandidate[];
  summary: CampaignAnalysisSummary | null;
}

export interface ErpInsights {
  source: 'ai' | 'heuristic';
  insights: string[];
  text: string;
  generatedAt: string;
}

export interface ErpAlert {
  level: 'success' | 'info' | 'warning';
  code: string;
  message: string;
  value?: number;
}

export interface ErpSyncResult {
  synced: number;
  from: string;
  to: string;
}

export interface ErpCacheStatus {
  products: { count: number; syncedAt: string | null };
  sales: { count: number; syncedAt: string | null };
  promotions?: { count: number; syncedAt: string | null };
  campaigns?: { count: number; syncedAt: string | null };
}

export interface ErpProductPromotion {
  id: number;
  name: string;
  type: string;
  typeName: string;
  promoPrice: number;
  retailPrice: number;
  conditions: string;
  remainingGpPct: number | null;
}

export interface ErpProductDetail {
  sku: string;
  productId: number;
  name: string;
  category: string;
  brand: string;
  imageUrl: string;
  abcCompany: string;
  costPrice: number;
  retailPrice: number;
  normalGpPct: number;
  sales: {
    revenue: number;
    qtySold: number;
    gpBaht: number;
    gpPct: number;
    periodDays: number;
  } | null;
  promotions: ErpProductPromotion[];
}

/** A campaign from the ErpCampaignCache */
export interface ErpCampaignCacheItem {
  campaignId: number;
  code: string | null;
  name: string;
  promotionType: string | null;
  promotionTypeName: string | null;
  dateStart: string | null;
  dateStop: string | null;
  retailPrice: string;
  promoPrice: string;
  discountPct: string;
  isActive: boolean;
  productCount: number;
  conditions: string | null;
  freeItems: Array<{
    sku: string;
    productId: number;
    name: string;
    qty: number;
  }> | null;
  products: Array<{
    sku: string;
    productId: number;
    name: string;
    imageUrl: string;
    promoPrice: number;
    retailPrice: number;
    minQty: number;
    freeItemQty: number;
    gp: number | null;
    stepText: string;
  }> | null;
  syncedAt: string;
}

/** Promotion step that a SKU is part of — returned by /erp/promotions/sku/:sku */
export interface SkuPromotionStep {
  campaignId: number;
  campaignName: string;
  promotionType: string | null;
  promotionTypeName: string | null;
  dateStart: string | null;
  dateStop: string | null;
  promoPrice: number;
  retailPrice: number;
  minQty: number;
  freeItemQty: number;
  gp: number | null;
  /** e.g. "ซื้อ 2 ชิ้น ฿89" */
  stepText: string;
}
