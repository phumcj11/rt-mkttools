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
  yoyRevenueGrowthPct: number;
  yoyOrders: number;
  yoyOrdersGrowthPct: number;
  yoyAvgTicket: number;
  yoyAvgTicketGrowthPct: number;
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
    yoyRevenueGrowthPct: number;
    yoyOrdersGrowthPct: number;
    yoyAvgTicketGrowthPct: number;
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
    message: string;
    buckets: Array<{ label: string; count: number }>;
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

export function getCommandCenter(opts?: { from?: string; to?: string; force?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  if (opts?.force) params.set('force', 'true');
  const q = params.toString();
  return apiRequest<CommandCenterData>(`/revenue/command-center${q ? `?${q}` : ''}`);
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
