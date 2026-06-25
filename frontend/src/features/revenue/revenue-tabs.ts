export type RevenueTabId =
  | 'overview'
  | 'branch-sales'
  | 'bills-avg'
  | 'campaign'
  | 'declining'
  | 'products'
  | 'categories'
  | 'customer'
  | 'reviews'
  | 'field';

export const REVENUE_TABS: Array<{ id: RevenueTabId; labelKey: string }> = [
  { id: 'overview', labelKey: 'tabs.overview' },
  { id: 'branch-sales', labelKey: 'tabs.branchSales' },
  { id: 'bills-avg', labelKey: 'tabs.billsAvg' },
  { id: 'campaign', labelKey: 'tabs.campaign' },
  { id: 'declining', labelKey: 'tabs.declining' },
  { id: 'products', labelKey: 'tabs.products' },
  { id: 'categories', labelKey: 'tabs.categories' },
  { id: 'customer', labelKey: 'tabs.customer' },
  { id: 'reviews', labelKey: 'tabs.reviews' },
  { id: 'field', labelKey: 'tabs.field' },
];

export function parseRevenueTab(raw: string | null): RevenueTabId {
  const ids = new Set(REVENUE_TABS.map((t) => t.id));
  if (raw && ids.has(raw as RevenueTabId)) return raw as RevenueTabId;
  return 'overview';
}
