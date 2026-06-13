import { apiRequest } from './api';
import type { Category, Product, ProductInput } from './types';

export type ProductCatalogFilter = 'all' | 'new' | 'changed' | 'missing_image' | 'ready' | 'low_gp' | 'promo' | 'inactive';

export interface ProductCatalogItem {
  sku: string;
  productId: number;
  name: string;
  category: string;
  brand: string;
  retailPrice: number;
  costSales: number;
  marginGpPct: number;
  salesGpPct: number;
  effectiveGpPct: number;
  imageUrl: string;
  abcCompany: string;
  revenue: number;
  qtySold: number;
  gpBaht: number;
  periodDays: number;
  activePromotionCount: number;
  promotionNames: string;
  lowestPromoPrice: number | null;
  bestRemainingGpPct: number | null;
  promotions?: Array<{
    id: number;
    name: string;
    type: string;
    typeName?: string;
    promoPrice: number;
    retailPrice: number;
    conditions: string;
    remainingGpPct: number | null;
  }>;
  isActive: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastChangedAt: string | null;
  syncedAt: string | null;
  marketingReadiness: string;
  flags: string[];
}

export interface ProductCatalogResponse {
  items: ProductCatalogItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductCatalogStatus {
  products: { count: number; syncedAt: string | null };
  sales: { count: number; syncedAt: string | null };
  promotions: { count: number; syncedAt: string | null };
  latestRun: {
    id: number;
    status: 'running' | 'success' | 'failed';
    source: string;
    totalCount: number;
    newCount: number;
    changedCount: number;
    inactiveCount: number;
    promotionCount: number;
    salesCount: number;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
  } | null;
}

export function listProducts() {
  return apiRequest<Product[]>('/products');
}

export function listProductCatalog(params: {
  q?: string;
  filter?: ProductCatalogFilter;
  category?: string;
  brand?: string;
  abc?: string;
  page?: number;
  limit?: number;
} = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  return apiRequest<ProductCatalogResponse>(`/products/catalog?${search.toString()}`);
}

export function getProductCatalogStatus() {
  return apiRequest<ProductCatalogStatus>('/products/catalog/status');
}

export function syncProductCatalog() {
  return apiRequest<unknown>('/products/catalog/sync', { method: 'POST' });
}

export function getProductCatalogDetail(sku: string) {
  return apiRequest<ProductCatalogItem>(`/products/catalog/${encodeURIComponent(sku)}`);
}

export function createProduct(input: ProductInput) {
  return apiRequest<Product>('/products', { method: 'POST', body: input });
}

export function updateProduct(id: number, input: Partial<ProductInput>) {
  return apiRequest<Product>(`/products/${id}`, { method: 'PATCH', body: input });
}

export function deleteProduct(id: number) {
  return apiRequest<{ message: string }>(`/products/${id}`, { method: 'DELETE' });
}

export function listCategories() {
  return apiRequest<Category[]>('/categories');
}

export function createCategory(name: string) {
  return apiRequest<Category>('/categories', { method: 'POST', body: { name } });
}

export function deleteCategory(id: number) {
  return apiRequest<{ message: string }>(`/categories/${id}`, { method: 'DELETE' });
}
