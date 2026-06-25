import { apiRequest } from './api';

export type BranchHealthStatus = 'green' | 'yellow' | 'red';

export interface BranchHealthRow {
  id: number;
  code: string;
  name: string;
  shortcode: string;
  revenue: number;
  prevRevenue: number;
  revenueGrowthPct: number;
  orders: number;
  prevOrders: number;
  ordersGrowthPct: number;
  avgTicket: number;
  prevAvgTicket: number;
  avgTicketGrowthPct: number;
  yoyRevenue: number;
  yoyRevenueGrowthPct: number | null;
  yoyOrders: number;
  yoyOrdersGrowthPct: number | null;
  yoyAvgTicket: number;
  yoyAvgTicketGrowthPct: number | null;
  yoyReliable: boolean;
  status: BranchHealthStatus;
  concernScore: number;
}

export interface ProductActionRow {
  sku: string;
  name: string;
  category: string;
  brand: string;
  revenue: number;
  qtySold: number;
  gpPct: number;
  abcCompany: string;
  imageUrl: string;
  retailPrice: number;
}

export interface DiagnosisItem {
  factor: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface CommandCenterData {
  generatedAt: string;
  period: {
    from: string;
    to: string;
    mtdFrom: string;
    mtdTo: string;
    prevFrom: string;
    prevTo: string;
    yoyFrom: string;
    yoyTo: string;
    yesterday: string;
  };
  kpi: {
    today: { revenue: number; orders: number };
    yesterday: { revenue: number; orders: number; avgTicket: number };
    mtd: { revenue: number; orders: number; avgTicket: number };
    prevPeriod: { revenue: number; orders: number; avgTicket: number };
    yoyPeriod: { revenue: number; orders: number; avgTicket: number };
    revenueGrowthPct: number;
    ordersGrowthPct: number;
    avgTicketGrowthPct: number;
    yoyRevenueGrowthPct: number | null;
    yoyOrdersGrowthPct: number | null;
    yoyAvgTicketGrowthPct: number | null;
    yoyReliable: boolean;
    yoyMessage: string;
    yoySource: 'erp_live' | 'daily_cache';
    targetConfigured: boolean;
    targetRevenue: number | null;
    targetGap: number | null;
    benchmarkMode: boolean;
    avgBillUpliftNeeded: number | null;
    expectedRemainingBills: number;
  };
  branchHealth: {
    total: number;
    green: number;
    yellow: number;
    red: number;
    branches: BranchHealthRow[];
    worstBranch: BranchHealthRow | null;
  };
  diagnosis: DiagnosisItem[];
  topProducts: ProductActionRow[];
  categories: Array<{ category: string; revenue: number; qtySold: number; gpPct: number }>;
  slowMoving: ProductActionRow[];
  frontStoreCandidates: ProductActionRow[];
  timeseries: Array<{ date: string; revenue: number; orders: number }>;
  traffic: {
    available: boolean;
    totalFootTraffic: number;
    totalTransactions: number;
    conversionPct: number | null;
    entryCount: number;
    recent: Array<{
      id: number;
      branchId: number;
      branchCode: string | null;
      trafficDate: string;
      footTraffic: number;
      transactions: number | null;
    }>;
  };
  customerMix: {
    available: boolean;
    total: number;
    breakdown: Array<{ customerType: string; count: number; pct: number }>;
    entryCount: number;
  };
  billNearPromo: {
    available: boolean;
    message: string | null;
    source: string | null;
    totalBills: number;
    buckets: Array<{ id: string; label: string; count: number }>;
    branches: Array<{
      id: number;
      code: string;
      shortcode: string;
      name: string;
      total: number;
      buckets: Array<{ id: string; label: string; count: number }>;
    }>;
  };
  activeBranchCodes: string[];
  activeBranches: Array<{
    id: number;
    code: string;
    shortcode: string;
    name: string;
  }>;
}

export interface SalesTargetRow {
  id: number;
  tenantId: number;
  yearMonth: string;
  branchId: number | null;
  branchCode: string | null;
  targetRevenue: string;
  targetTransactions: number | null;
  targetAvgTicket: string | null;
  notes: string | null;
}

export interface TrafficEntryInput {
  branchId: number;
  branchCode?: string | null;
  trafficDate: string;
  footTraffic: number;
  transactions?: number | null;
  notes?: string | null;
}

export interface CustomerMixEntryInput {
  branchId: number;
  branchCode?: string | null;
  mixDate: string;
  customerType: string;
  count: number;
  pct?: number | null;
}

export interface CountryAnalyticsData {
  generatedAt: string;
  period: { from: string; to: string };
  selectedCountry: string;
  dataQuality: {
    reliable: boolean;
    countrySource: string | null;
    receiptLineSource: string | null;
    missingFields: string[];
    warnings: string[];
  };
  countries: Array<{
    country: string;
    orders: number;
    revenue: number;
    avgTicket: number;
    customers: number;
    revenueSharePct: number;
  }>;
  selectedCountrySummary: {
    country: string;
    orders: number;
    revenue: number;
    avgTicket: number;
    receiptCount: number;
  };
  topProducts: Array<{
    sku: string;
    name: string;
    category: string;
    qty: number;
    revenue: number;
    receiptCount: number;
  }>;
  basketPairs: Array<{
    leftSku: string;
    leftName: string;
    rightSku: string;
    rightName: string;
    receiptCount: number;
    supportPct: number;
    revenue: number;
  }>;
  aiSummary: {
    available: boolean;
    source: 'openai' | 'heuristic' | 'none';
    text: string;
  };
}

export interface BranchDailySalesData {
  generatedAt: string;
  period: { from: string; to: string };
  dates: string[];
  branches: Array<{
    id: number;
    code: string;
    shortcode: string;
    name: string;
    points: Array<{ date: string; revenue: number; orders: number }>;
    totalRevenue: number;
  }>;
  verification: {
    date: string;
    branchSum: number;
    erpByBranch: number;
    match: boolean;
  } | null;
}

export function getCommandCenter(opts?: { from?: string; to?: string; force?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  if (opts?.force) params.set('force', 'true');
  const q = params.toString();
  return apiRequest<CommandCenterData>(`/revenue/command-center${q ? `?${q}` : ''}`);
}

export function getBranchDailySales(opts?: { from?: string; to?: string; force?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  if (opts?.force) params.set('force', 'true');
  const q = params.toString();
  return apiRequest<BranchDailySalesData>(`/revenue/branch-daily-sales${q ? `?${q}` : ''}`);
}

export function getCountryAnalytics(opts?: {
  from?: string;
  to?: string;
  country?: string;
  force?: boolean;
}) {
  const params = new URLSearchParams();
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  if (opts?.country) params.set('country', opts.country);
  if (opts?.force) params.set('force', 'true');
  const q = params.toString();
  return apiRequest<CountryAnalyticsData>(`/revenue/country-analytics${q ? `?${q}` : ''}`);
}

export interface BranchCountryAnalyticsData {
  generatedAt: string;
  period: { from: string; to: string };
  dataQuality: {
    reliable: boolean;
    source: string | null;
    warnings: string[];
  };
  branches: Array<{
    id: number;
    code: string;
    shortcode: string;
    name: string;
    totalRevenue: number;
    topCountries: Array<{
      rank: number;
      country: string;
      revenue: number;
      orders: number;
      revenueSharePct: number;
    }>;
  }>;
}

export interface BranchCountryProductsData {
  generatedAt: string;
  period: { from: string; to: string };
  branchId: number;
  branchCode: string;
  country: string;
  dataQuality: {
    reliable: boolean;
    source: string | null;
    warnings: string[];
  };
  products: Array<{
    sku: string;
    name: string;
    category: string;
    qty: number;
    revenue: number;
    orders: number;
  }>;
}

export function getBranchCountryAnalytics(opts?: {
  from?: string;
  to?: string;
  branchId?: number;
  force?: boolean;
}) {
  const params = new URLSearchParams();
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  if (opts?.branchId) params.set('branchId', String(opts.branchId));
  if (opts?.force) params.set('force', 'true');
  const q = params.toString();
  return apiRequest<BranchCountryAnalyticsData>(`/revenue/branch-country-analytics${q ? `?${q}` : ''}`);
}

export function getBranchCountryProducts(opts: {
  branchId: number;
  country: string;
  from?: string;
  to?: string;
  force?: boolean;
}) {
  const params = new URLSearchParams();
  params.set('branchId', String(opts.branchId));
  params.set('country', opts.country);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.force) params.set('force', 'true');
  return apiRequest<BranchCountryProductsData>(`/revenue/branch-country-products?${params.toString()}`);
}

export function getSalesTargets(yearMonth?: string) {
  const q = yearMonth ? `?yearMonth=${encodeURIComponent(yearMonth)}` : '';
  return apiRequest<SalesTargetRow[]>(`/revenue/targets${q}`);
}

export function upsertSalesTargets(
  targets: Array<{
    yearMonth: string;
    branchId?: number | null;
    branchCode?: string | null;
    targetRevenue: number;
    targetTransactions?: number | null;
    targetAvgTicket?: number | null;
    notes?: string | null;
  }>,
) {
  return apiRequest<SalesTargetRow[]>('/revenue/targets', {
    method: 'PATCH',
    body: { targets },
  });
}

export function upsertTraffic(entries: TrafficEntryInput[]) {
  return apiRequest<unknown>('/revenue/traffic', { method: 'POST', body: { entries } });
}

export function upsertCustomerMix(entries: CustomerMixEntryInput[]) {
  return apiRequest<unknown>('/revenue/customer-mix', { method: 'POST', body: { entries } });
}

export interface StorefrontActivityRow {
  id: number;
  tenantId: number;
  branchId: number;
  branchCode: string | null;
  activityDate: string;
  title: string;
  description: string | null;
  photoUrls: string[] | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export function listStorefrontActivities(opts?: {
  from?: string;
  to?: string;
  branchId?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  if (opts?.branchId) params.set('branchId', String(opts.branchId));
  const q = params.toString();
  return apiRequest<StorefrontActivityRow[]>(`/revenue/storefront-activities${q ? `?${q}` : ''}`);
}

export function createStorefrontActivity(body: {
  branchId: number;
  branchCode?: string | null;
  activityDate: string;
  title: string;
  description?: string | null;
  photoUrls?: string[];
  photoDataUrls?: string[];
}) {
  return apiRequest<StorefrontActivityRow>('/revenue/storefront-activities', {
    method: 'POST',
    body,
  });
}

export interface BranchAiAnalysisData {
  generatedAt: string;
  branch: { id: number; code: string; shortcode: string; name: string };
  period: { from: string; to: string };
  metrics: {
    mtd: { revenue: number; orders: number; avgTicket: number };
    threeMonth: { revenue: number; orders: number; avgTicket: number };
    momRevenueGrowthPct: number;
    status: BranchHealthStatus;
    concernScore: number;
  };
  monthlyTrend: Array<{ month: string; revenue: number; orders: number }>;
  topProducts: Array<{ sku: string; name: string; category: string; revenue: number; qtySold: number }>;
  ai: {
    available: boolean;
    source: 'openai' | 'heuristic' | 'none';
    summary: string;
    rootCauses: string[];
    recommendedActions: string[];
    promotionIdeas: string[];
    stockClearIdeas: string[];
    risks: string[];
    next7DayChecklist: string[];
  };
}

export function getBranchAiAnalysis(branchId: number, opts?: { force?: boolean }) {
  const params = new URLSearchParams({ branchId: String(branchId) });
  if (opts?.force) params.set('force', 'true');
  return apiRequest<BranchAiAnalysisData>(`/revenue/branch-ai-analysis?${params.toString()}`);
}
