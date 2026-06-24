import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/exceptions/app.exception';
import { ErpConfig } from '../../config/configuration';

type Query = Record<string, string | number | undefined>;

interface ErpEnvelope<T> {
  ok: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

interface CacheEntry<T> { data: T; expiry: number }

export interface ErpProbeResult<T> {
  supported: boolean;
  source: string | null;
  data: T[];
  missingFields: string[];
  message: string | null;
}

export interface ErpCountrySalesRow {
  country: string;
  orders: number;
  revenue: number;
  avgTicket: number;
  customers: number;
}

export interface ErpReceiptLineRow {
  receiptNo: string;
  saleDate: string;
  customerCountry: string;
  branchId: number;
  branchCode: string;
  sku: string;
  productName: string;
  category: string;
  qty: number;
  revenue: number;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const str = (...values: unknown[]): string => {
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
};

// Default TTLs (ms)
const TTL_DASHBOARD  = 5  * 60 * 1_000; // 5 min — today/week/month totals
const TTL_SALES      = 5  * 60 * 1_000; // 5 min — date-range summaries
const TTL_STATIC     = 30 * 60 * 1_000; // 30 min — counts, branches, promotions

@Injectable()
export class ErpService {
  private readonly logger = new Logger(ErpService.name);
  private readonly cfg: ErpConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly cache = new Map<string, CacheEntry<any>>();

  constructor(private readonly config: ConfigService) {
    this.cfg = this.config.getOrThrow<ErpConfig>('erp');
  }

  private cacheGet<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) { this.cache.delete(key); return undefined; }
    return entry.data;
  }

  private cacheSet<T>(key: string, data: T, ttlMs: number) {
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  clearCache(pattern?: string) {
    if (!pattern) { this.cache.clear(); return; }
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) this.cache.delete(key);
    }
  }

  // ---------- public API (normalized) ----------

  async dashboardSummary(force = false) {
    const d = await this.call<any>('dashboard', 'summary', {}, force, TTL_DASHBOARD);
    const row = Array.isArray(d) ? d[0] : d;
    return {
      revenue: {
        today: num(row?.revenue?.today),
        week: num(row?.revenue?.week),
        month: num(row?.revenue?.month),
        year: num(row?.revenue?.year),
      },
      ordersToday: num(row?.orders_today),
      counts: {
        products: num(row?.counts?.products),
        branches: num(row?.counts?.branches),
        customers: num(row?.counts?.customers),
        suppliers: num(row?.counts?.suppliers),
      },
      trend30: Array.isArray(row?.trend30)
        ? row.trend30.map((t: any) => ({
            date: String(t.d),
            revenue: num(t.revenue),
            orders: num(t.orders),
          }))
        : [],
    };
  }

  async salesSummary(from: string, to: string, branchId?: number, force = false) {
    const d = await this.call<any>('sales', 'summary', { from, to, branch_id: branchId }, force, TTL_SALES);
    const row = Array.isArray(d) ? d[0] : d;
    return {
      orders: num(row?.orders),
      revenue: num(row?.revenue),
      gross: num(row?.gross),
      discount: num(row?.discount),
      avgTicket: num(row?.avg_ticket),
    };
  }

  async salesByBranch(from: string, to: string, force = false) {
    const d = await this.call<any[]>('sales', 'by_branch', { from, to }, force, TTL_SALES);
    return (d ?? []).map((b) => ({
      id: num(b.id),
      code: String(b.code ?? ''),
      name: String(b.name ?? ''),
      shortcode: String(b.shortcode ?? ''),
      orders: num(b.orders),
      revenue: num(b.revenue),
      avgTicket: num(b.avg_ticket),
    }));
  }

  async topProducts(from: string, to: string, limit = 10, branchId?: number, force = false) {
    const d = await this.call<any[]>('sales', 'top_products', {
      from, to, limit, branch_id: branchId,
    }, force, TTL_SALES);
    return (d ?? []).map((p) => ({
      id: num(p.id),
      sku: String(p.sku ?? ''),
      name: String(p.name ?? ''),
      category: String(p.category ?? ''),
      brand: String(p.brand ?? ''),
      qtySold: num(p.qty_sold ?? p.quantity_sold),
      revenue: num(p.revenue),
      gpBaht: num(p.gp_baht),
      gpPct: num(p.gp_pct),
      abcCompany: String(p.abc_company ?? ''),
      imageUrl: String(p.image_url ?? ''),
    }));
  }

  async timeseries(from: string, to: string, bucket: 'day' | 'week' | 'month', branchId?: number, force = false) {
    const d = await this.call<any[]>('sales', 'timeseries', {
      from, to, bucket, branch_id: branchId,
    }, force, TTL_SALES);
    return (d ?? []).map((t) => ({
      date: String(t.d),
      revenue: num(t.revenue),
      orders: num(t.orders),
    }));
  }

  async branches(force = false) {
    const d = await this.call<any[]>('branches', 'list', {
      exclude_internal: 1,
      status: 'ACTIVE',
    }, force, TTL_STATIC);
    return (d ?? []).map((b) => ({
      id: num(b.id),
      code: String(b.code ?? ''),
      shortcode: String(b.shortcode ?? ''),
      name: String(b.name ?? ''),
      address: String(b.address ?? ''),
      storeFormat: String(b.store_format ?? ''),
      status: String(b.status ?? ''),
      regionGroup: String(b.region_group ?? ''),
    }));
  }

  async topBuyers(from: string, to: string, limit = 10, force = false) {
    const d = await this.call<any[]>('customers', 'top_buyers', { from, to, limit }, force, TTL_SALES);
    return (d ?? []).map((c) => ({
      id: num(c.id),
      code: String(c.code ?? ''),
      name: String(c.name ?? ''),
      orders: num(c.orders),
      revenue: num(c.revenue),
      avgTicket: num(c.avg_ticket),
    }));
  }

  async customerCountrySales(
    from: string,
    to: string,
    limit = 30,
    force = false,
  ): Promise<ErpProbeResult<ErpCountrySalesRow>> {
    const candidates = [
      ['customers', 'by_country'],
      ['customers', 'country_summary'],
      ['customers', 'by_nationality'],
      ['sales', 'by_country'],
      ['sales', 'customer_country'],
      ['sales', 'by_customer_country'],
    ] as const;

    for (const [resource, action] of candidates) {
      try {
        const raw = await this.call<any[]>(resource, action, { from, to, limit }, force, TTL_SALES);
        const rows = (raw ?? [])
          .map((r) => {
            const country = str(
              r.country,
              r.country_name,
              r.customer_country,
              r.nationality,
              r.nationality_name,
              r.nation,
            );
            const orders = num(r.orders ?? r.bill_count ?? r.receipts ?? r.transactions);
            const revenue = num(r.revenue ?? r.amount ?? r.total_amount ?? r.net_sales);
            return {
              country,
              orders,
              revenue,
              avgTicket: num(r.avg_ticket ?? (orders > 0 ? revenue / orders : 0)),
              customers: num(r.customers ?? r.customer_count),
            };
          })
          .filter((r) => r.country && (r.revenue > 0 || r.orders > 0))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, limit);

        return {
          supported: true,
          source: `${resource}/${action}`,
          data: rows,
          missingFields: rows.length ? [] : ['country', 'revenue'],
          message: rows.length ? null : 'ERP endpoint exists but returned no country sales rows',
        };
      } catch {
        // Try the next known ERP endpoint shape.
      }
    }

    return {
      supported: false,
      source: null,
      data: [],
      missingFields: ['customer_country_or_nationality'],
      message: 'ERP does not expose customer country/nationality aggregation via known endpoints',
    };
  }

  async receiptLines(
    from: string,
    to: string,
    params: { country?: string; limit?: number } = {},
    force = false,
  ): Promise<ErpProbeResult<ErpReceiptLineRow>> {
    const limit = params.limit ?? 5000;
    const q: Query = { from, to, limit };
    if (params.country) q.country = params.country;

    const candidates = [
      ['sales', 'receipt_lines'],
      ['sales', 'invoice_lines'],
      ['sales', 'basket_lines'],
      ['sales', 'order_lines'],
      ['invoices', 'lines'],
      ['receipts', 'lines'],
    ] as const;

    for (const [resource, action] of candidates) {
      try {
        const raw = await this.call<any[]>(resource, action, q, force, TTL_SALES);
        const requestedCountry = (params.country ?? '').trim().toLowerCase();
        const rows = (raw ?? [])
          .map((r) => ({
            receiptNo: str(r.receipt_no, r.receipt, r.invoice_no, r.bill_no, r.order_no, r.doc_no, r.document_no),
            saleDate: str(r.sale_date, r.date, r.d, r.sold_at, r.created_at).slice(0, 10),
            customerCountry: str(r.customer_country, r.country, r.country_name, r.nationality, r.nationality_name),
            branchId: num(r.branch_id),
            branchCode: str(r.branch_code, r.branch_shortcode, r.branch),
            sku: str(r.sku, r.product_sku, r.product_code, r.item_code),
            productName: str(r.product_name, r.name, r.item_name),
            category: str(r.category, r.category_name),
            qty: num(r.qty ?? r.quantity ?? r.qty_sold),
            revenue: num(r.revenue ?? r.amount ?? r.total_amount ?? r.net_amount),
          }))
          .filter((r) => r.receiptNo && r.sku)
          .filter((r) => {
            if (!requestedCountry) return true;
            return r.customerCountry.trim().toLowerCase() === requestedCountry;
          })
          .slice(0, limit);

        return {
          supported: true,
          source: `${resource}/${action}`,
          data: rows,
          missingFields: rows.length ? [] : ['receipt_no', 'sku'],
          message: rows.length ? null : 'ERP endpoint exists but returned no receipt line rows',
        };
      } catch {
        // Try the next known ERP endpoint shape.
      }
    }

    return {
      supported: false,
      source: null,
      data: [],
      missingFields: ['receipt_lines'],
      message: 'ERP does not expose receipt/invoice line items via known endpoints',
    };
  }

  async promotions(limit = 50, force = false) {
    const d = await this.call<any[]>('promotions', 'list', { active_only: 1, limit }, force, TTL_STATIC);
    return (d ?? []).map((p) => ({
      id: num(p.id),
      code: String(p.code ?? ''),
      name: String(p.promotion_name ?? p.name ?? ''),
      type: String(p.promotion_type ?? ''),
      typeName: String(p.promotion_type_name ?? ''),
      dateStart: String(p.date_start ?? ''),
      dateStop: String(p.date_stop ?? ''),
      retailPrice: num(p.retail_price ?? p.price ?? 0),
      promoPrice: num(p.promo_price ?? p.promotion_price ?? 0),
      wholesalePrice: num(p.wholesale_price ?? 0),
      productCount: num(p.product_count),
      freeItemCount: num(p.free_item_count),
      discountPct: num(p.discount_pct ?? p.discount_percent ?? 0),
      branch: p.branch_id ? num(p.branch_id) : null,
      branchName: p.branch_name ? String(p.branch_name) : null,
    }));
  }

  // ---------- new normalizers for Campaign Planner ----------

  async productsList(params: {
    q?: string;
    category?: number;
    abc?: string;
    hasStock?: 1 | 0;
    page?: number;
    limit?: number;
  } = {}, force = false) {
    const q: Query = {};
    if (params.q)        q.q = params.q;
    if (params.category) q.category = params.category;
    if (params.abc)      q.abc = params.abc;
    if (params.hasStock !== undefined) q.has_stock = params.hasStock;
    if (params.page)     q.page = params.page;
    q.limit = params.limit ?? 50;
    const d = await this.call<any[]>('products', 'list', q, force, TTL_STATIC);
    return (d ?? []).map((p) => ({
      id: num(p.id),
      sku: String(p.sku ?? ''),
      name: String(p.name ?? ''),
      category: String(p.category ?? ''),
      brand: String(p.brand ?? ''),
      abcCompany: String(p.abc_company ?? ''),
      costSales: num(p.cost_sales ?? p.cost ?? 0),
      retailPrice: num(p.retail_price ?? p.price ?? 0),
      imageUrl: String(p.image_url ?? ''),
      productType: String(p.product_type ?? ''),
    }));
  }

  async skuBranchSales(from: string, to: string, params: {
    category?: number;
    abc?: string;
    page?: number;
    limit?: number;
  } = {}, force = false) {
    const q: Query = { from, to };
    if (params.category) q.category_id = params.category;
    if (params.abc)      q.abc = params.abc;
    if (params.page)     q.page = params.page;
    q.limit = params.limit ?? 100;
    const d = await this.call<any[]>('sales', 'by_sku_branch', q, force, TTL_SALES);
    return (d ?? []).map((r) => ({
      sku: String(r.sku ?? ''),
      productId: num(r.product_id),
      name: String(r.name ?? ''),
      category: String(r.category ?? ''),
      brand: String(r.brand ?? ''),
      qtySold: num(r.qty_sold),
      revenue: num(r.revenue),
      gpBaht: num(r.gp_baht),
      gpPct: num(r.gp_pct),
      abcCompany: String(r.abc_company ?? ''),
      abcBranch: String(r.abc_branch ?? ''),
    }));
  }

  async inventorySnapshot(params: {
    abc?: string;
    limit?: number;
  } = {}, force = false) {
    const q: Query = { limit: params.limit ?? 200 };
    if (params.abc) q.abc = params.abc;
    const d = await this.call<any[]>('inventory', 'snapshot_all', q, force, TTL_STATIC);
    return (d ?? []).map((r) => ({
      sku: String(r.sku ?? ''),
      productId: num(r.product_id),
      branchId: num(r.branch_id),
      qty: num(r.quantity_balance ?? r.qty ?? 0),
      minStock: num(r.min_stock ?? 0),
    }));
  }

  async promotionsByProduct(productId: number) {
    const d = await this.call<any[]>('promotions', 'by_product', { product_id: productId, active_only: 1 }, false, TTL_STATIC);
    return (d ?? []).map((p) => ({
      id: num(p.id),
      name: String(p.promotion_name ?? p.name ?? ''),
      type: String(p.promotion_type ?? ''),
    }));
  }

  async promotionDetail(campaignId: number, force = false) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = await this.call<any>('promotions', 'detail', { campaign_id: campaignId }, force, TTL_STATIC);
    if (!d) return null;
    const row = Array.isArray(d) ? d[0] : d;
    return {
      id: num(row.id ?? row.campaign_id),
      code: String(row.code ?? ''),
      name: String(row.promotion_name ?? row.name ?? ''),
      type: String(row.promotion_type ?? ''),
      typeName: String(row.promotion_type_name ?? ''),
      dateStart: String(row.date_start ?? ''),
      dateStop: String(row.date_stop ?? ''),
      retailPrice: num(row.retail_price ?? row.price ?? 0),
      promoPrice: num(row.promo_price ?? row.promotion_price ?? 0),
      discountPct: num(row.discount_pct ?? 0),
      conditions: String(row.conditions ?? ''),
      minQty: num(row.min_qty ?? row.promo_quantity ?? row.quantity_buy ?? row.buy_qty ?? 0),
      minAmount: num(row.min_amount ?? row.amount ?? row.promo_amount ?? row.value ?? 0),
    };
  }

  async promotionProducts(campaignId: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = await this.call<any[]>('promotions', 'products', { campaign_id: campaignId }, false, TTL_STATIC);
    return (d ?? []).map((p) => ({
      sku: String(p.sku ?? ''),
      productId: num(p.product_id),
      name: String(p.name ?? ''),
      imageUrl: String(p.image_url ?? ''),
      promoPrice: num(p.promo_price ?? p.promotion_price ?? 0),
      retailPrice: num(p.retail_price ?? p.price ?? 0),
      minQty: num(p.min_qty ?? p.qty_min ?? 1),
      freeItemQty: num(p.free_item_qty ?? p.free_qty ?? 0),
      costSales: num(p.cost_sales ?? p.cost ?? 0),
      conditions: String(p.conditions ?? p.step_text ?? ''),
    }));
  }

  async promotionFreeItems(campaignId: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = await this.call<any[]>('promotions', 'free_items', { campaign_id: campaignId }, false, TTL_STATIC);
    return (d ?? []).map((p) => ({
      sku: String(p.sku ?? ''),
      productId: num(p.product_id),
      name: String(p.name ?? p.product_name ?? ''),
      qty: num(p.qty ?? p.free_qty ?? 1),
    }));
  }

  async promotionsByProductDetail(productId: number, force = false, activeOnly = true) {
    const params: Query = { product_id: productId };
    if (activeOnly) params.active_only = 1;
    const d = await this.call<any[]>('promotions', 'by_product', params, force, TTL_STATIC);
    return (d ?? []).map((p) => ({
      id: num(p.id ?? p.campaign_id),
      code: String(p.code ?? ''),
      name: String(p.promotion_name ?? p.name ?? ''),
      type: String(p.promotion_type ?? ''),
      typeName: String(p.promotion_type_name ?? ''),
      promoPrice: num(p.promo_price ?? p.promotion_price ?? 0),
      retailPrice: num(p.retail_price ?? p.price ?? 0),
      minQty: num(p.min_qty ?? p.promo_quantity ?? p.qty_min ?? 0),
      minAmount: num(p.min_amount ?? p.amount ?? p.promo_amount ?? 0),
      freeItemQty: num(p.free_item_qty ?? p.free_qty ?? 0),
      conditions: String(p.conditions ?? ''),
      dateStart: String(p.date_start ?? ''),
      dateStop: String(p.date_stop ?? ''),
      remainingGpPct: p.remaining_gp_pct != null ? num(p.remaining_gp_pct) : null,
    }));
  }

  /** Resolve ERP product row by SKU (live products/list) */
  async findProductBySku(sku: string, force = false) {
    const normalSku = String(sku ?? '').replace(/\s+/g, '').toUpperCase();
    if (!normalSku) return null;
    const rows = await this.productsList({ q: normalSku, limit: 30 }, force);
    return rows.find((r) => String(r.sku ?? '').replace(/\s+/g, '').toUpperCase() === normalSku) ?? null;
  }

  async campaignCandidates(params: {
    targetPrice: number;
    minGpPct: number;
    pieceQty?: number;
    from: string;
    to: string;
    category?: number;
    abc?: string;
    limit?: number;
    /** Pre-fetched product rows from DB cache — avoids ERP API call */
    cachedProducts?: Array<{
      id: number; sku: string; name: string; category: string; brand: string;
      retailPrice: number; costSales: number; imageUrl: string; abcCompany: string;
      productType?: string;
    }>;
    /** Pre-fetched sales rows from DB cache — avoids ERP API call */
    cachedSales?: Array<{
      sku: string; productId: number; revenue: number; qtySold: number;
      gpBaht: number; gpPct: number; abcCompany: string;
    }>;
  }) {
    const limit = params.limit ?? 500;
    const pieceQty = Math.max(1, params.pieceQty ?? 1);
    const perPieceTarget = params.targetPrice / pieceQty;

    // Use pre-fetched DB cache if provided, otherwise fall back to live ERP API
    let salesRows: Awaited<ReturnType<typeof this.skuBranchSales>>;
    let productRows: Awaited<ReturnType<typeof this.productsList>>;

    if (params.cachedProducts && params.cachedSales) {
      this.logger.debug('campaignCandidates: using DB cache');
      productRows = params.cachedProducts.map((p) => ({ ...p, productType: p.productType ?? '' }));
      // Adapt cached sales shape to match skuBranchSales output
      salesRows = params.cachedSales.map((s) => ({
        sku: s.sku,
        productId: s.productId,
        name: '',
        category: '',
        brand: '',
        qtySold: s.qtySold,
        revenue: s.revenue,
        gpBaht: s.gpBaht,
        gpPct: s.gpPct,
        abcCompany: s.abcCompany,
        abcBranch: '',
      }));
    } else {
      this.logger.debug('campaignCandidates: fetching live from ERP');
      [salesRows, productRows] = await Promise.all([
        this.skuBranchSales(params.from, params.to, {
          category: params.category,
          abc: params.abc,
          limit: 500,
        }, false),
        this.productsList({
          category: params.category,
          abc: params.abc,
          limit: 2000,
        }, false),
      ]);
    }

    const normalSku = (s: string) => s.replace(/\s+/g, '').toUpperCase();
    type ProdEntry = {
      id: number; sku: string; name: string; category: string; brand: string;
      retailPrice: number; costSales: number; imageUrl: string; abcCompany: string;
    };
    const prodBySku = new Map<string, ProdEntry>();
    const prodById  = new Map<number, ProdEntry>();
    for (const p of productRows) {
      const entry: ProdEntry = {
        id: p.id, sku: p.sku, name: p.name, category: p.category,
        brand: p.brand, retailPrice: p.retailPrice, costSales: p.costSales,
        imageUrl: p.imageUrl, abcCompany: p.abcCompany,
      };
      prodBySku.set(normalSku(p.sku), entry);
      if (p.id > 0) prodById.set(p.id, entry);
    }

    const resolveProd = (sku: string, productId: number) =>
      prodBySku.get(normalSku(sku)) ??
      (productId > 0 ? prodById.get(productId) : undefined);

    // Aggregate sales by SKU
    const salesMap = new Map<string, {
      sku: string; productId: number;
      qtySold: number; revenue: number; gpBaht: number; gpPct: number;
      abcCompany: string; salesName: string; salesCategory: string; salesBrand: string;
    }>();
    for (const row of salesRows) {
      const key = normalSku(row.sku);
      const existing = salesMap.get(key);
      if (existing) {
        existing.qtySold += row.qtySold;
        existing.revenue += row.revenue;
        existing.gpBaht  += row.gpBaht;
        if (row.gpPct > existing.gpPct) existing.gpPct = row.gpPct;
      } else {
        salesMap.set(key, {
          sku: row.sku, productId: row.productId,
          qtySold: row.qtySold, revenue: row.revenue,
          gpBaht: row.gpBaht, gpPct: row.gpPct,
          abcCompany: row.abcCompany,
          salesName: row.name, salesCategory: row.category, salesBrand: row.brand,
        });
      }
    }

    type RawCandidate = {
      sku: string; productId: number;
      name: string; category: string; brand: string; imageUrl: string;
      gpPct: number; gpBaht: number; revenue: number; qtySold: number;
      abcCompany: string;
      retailPrice: number; costSales: number;
      bundleCost: number; campaignGpPct: number | null; effectiveGpPct: number;
      minSellPrice: number; eligibleForTarget: boolean;
      discountNeeded: number; dataQuality: string[];
      hasSales: boolean;
    };

    const buildCandidate = (
      sku: string,
      productId: number,
      sales: {
        sku: string; productId: number;
        qtySold: number; revenue: number; gpBaht: number; gpPct: number;
        abcCompany: string; salesName: string; salesCategory: string; salesBrand: string;
      } | null,
      prod: ProdEntry | undefined,
    ): RawCandidate => {
      const retailPrice = prod?.retailPrice ?? 0;
      const costSales   = prod?.costSales   ?? 0;
      const name        = prod?.name        || sales?.salesName     || sku;
      const category    = prod?.category    || sales?.salesCategory || '';
      const brand       = prod?.brand       || sales?.salesBrand    || '';
      const imageUrl    = prod?.imageUrl    || '';
      const gpPct       = sales?.gpPct ?? 0;
      const abcCompany  = sales?.abcCompany || prod?.abcCompany || '';

      const bundleCost = costSales * pieceQty;
      const campaignGpPct =
        bundleCost > 0
          ? Math.round(((params.targetPrice - bundleCost) / params.targetPrice) * 1000) / 10
          : null;

      // Use the better GP between campaign calc and historical — includes more products
      const effectiveGpPct =
        campaignGpPct !== null
          ? Math.max(campaignGpPct, gpPct)
          : gpPct;

      const minSellPrice =
        bundleCost > 0
          ? Math.ceil((bundleCost / (1 - params.minGpPct / 100)) / 5) * 5
          : 0;

      // A product is "price-fit" when its per-piece retail is reasonably close to the
      // per-piece campaign target (0.5× – 1.5×).  A ฿19 item should never appear in a
      // "2 ชิ้น ฿100" (perPieceTarget = ฿50) suggestion — that would confuse customers.
      // Products with no retail price on file are allowed through (GP history is used).
      const priceFit =
        retailPrice === 0 ||
        (retailPrice >= perPieceTarget * 0.5 && retailPrice <= perPieceTarget * 1.5);

      const eligibleForTarget = effectiveGpPct >= params.minGpPct && priceFit;

      const dataQuality: string[] = [];
      if (!prod)                          dataQuality.push('no_master');
      if (costSales === 0)                dataQuality.push('no_cost');
      if (retailPrice === 0)              dataQuality.push('no_price');
      if (!priceFit && retailPrice > 0)   dataQuality.push('price_mismatch');

      const bundleRetail = retailPrice * pieceQty;
      const discountNeeded =
        bundleRetail > params.targetPrice
          ? Math.round(((bundleRetail - params.targetPrice) / bundleRetail) * 100)
          : 0;

      return {
        sku, productId, name, category, brand, imageUrl,
        gpPct, gpBaht: sales?.gpBaht ?? 0, revenue: sales?.revenue ?? 0,
        qtySold: sales?.qtySold ?? 0, abcCompany,
        retailPrice, costSales, bundleCost, campaignGpPct, effectiveGpPct,
        minSellPrice, eligibleForTarget, discountNeeded, dataQuality,
        hasSales: !!sales,
      };
    };

    const seen = new Set<string>();
    const merged: RawCandidate[] = [];

    // 1) Products with sales history
    for (const s of salesMap.values()) {
      const key = normalSku(s.sku);
      seen.add(key);
      merged.push(buildCandidate(s.sku, s.productId, s, resolveProd(s.sku, s.productId)));
    }

    // 2) Master catalog products not in sales — include when per-piece retail fits target
    for (const p of productRows) {
      const key = normalSku(p.sku);
      if (seen.has(key)) continue;
      if (params.abc && p.abcCompany && !p.abcCompany.startsWith(params.abc.charAt(0))) continue;
      if (p.retailPrice >= perPieceTarget * 0.5 && p.retailPrice <= perPieceTarget * 1.2) {
        seen.add(key);
        merged.push(buildCandidate(p.sku, p.id, null, p));
      }
    }

    const candidates = merged.filter((c) => c.eligibleForTarget);

    const maxRevenue = Math.max(...candidates.map((c) => c.revenue), 1);
    const qtyLabel = pieceQty > 1 ? `${pieceQty} ชิ้น ฿${params.targetPrice}` : `฿${params.targetPrice}`;

    const scored = candidates.map((c) => {
      const gpScore      = Math.min(c.effectiveGpPct / 100, 1) * 40;
      const salesScore   = c.hasSales ? (c.revenue / maxRevenue) * 40 : 5;
      const abcBonus     = c.abcCompany === 'ACOM' ? 20 : c.abcCompany === 'BCOM' ? 10 : 0;
      const dataBonus    = c.dataQuality.length === 0 ? 10 : 0;
      const priceFitBonus = c.retailPrice > 0 && c.retailPrice <= perPieceTarget ? 5 : 0;
      const score        = gpScore + salesScore + abcBonus + dataBonus + priceFitBonus;

      const reasons: string[] = [];
      if (c.campaignGpPct !== null && c.campaignGpPct >= params.minGpPct) {
        reasons.push(`${qtyLabel} → GP ${c.campaignGpPct.toFixed(0)}%`);
      } else if (c.gpPct >= params.minGpPct) {
        reasons.push(`GP ประวัติ ${c.gpPct.toFixed(0)}%`);
      }
      if (c.effectiveGpPct > (c.campaignGpPct ?? 0) && c.gpPct >= params.minGpPct) {
        reasons.push(`ใช้ GP ประวัติ ${c.gpPct.toFixed(0)}% (สูงกว่าคำนวณ)`);
      }
      if (c.abcCompany === 'ACOM') reasons.push('สินค้า A ขายดีมาก');
      else if (c.abcCompany === 'BCOM') reasons.push('สินค้า B ขายดี');
      if (c.revenue > maxRevenue * 0.5) reasons.push('ยอดขายสูง');
      if (c.retailPrice > 0 && c.retailPrice <= perPieceTarget)
        reasons.push(`ราคา/ชิ้น ฿${c.retailPrice} เข้าเกณฑ์`);
      if (!c.hasSales) reasons.push('สินค้าใน catalog (ยังไม่มียอดขายช่วงนี้)');

      const warnings: string[] = [];
      if (c.dataQuality.includes('no_cost'))        warnings.push('ไม่มีต้นทุน — ใช้ GP ประวัติ');
      if (c.dataQuality.includes('no_price'))       warnings.push('ไม่มีราคาขายใน master');
      if (c.dataQuality.includes('price_mismatch')) warnings.push(`ราคา/ชิ้น ฿${c.retailPrice} ต่างจากเป้า ฿${Math.round(perPieceTarget)} มาก`);
      if (c.effectiveGpPct < params.minGpPct + 5) warnings.push('GP ใกล้ขีดต่ำสุด');
      if (!['ACOM', 'BCOM'].includes(c.abcCompany) && c.hasSales) warnings.push('ยอดขายระดับ C/D');
      if (c.discountNeeded > 0)
        warnings.push(`ราคา ${pieceQty} ชิ้น ฿${(c.retailPrice * pieceQty).toFixed(0)} ต้องลด ${c.discountNeeded}%`);

      return {
        sku: c.sku, productId: c.productId,
        name: c.name, category: c.category, brand: c.brand,
        imageUrl: c.imageUrl,
        pieceQty,
        perPieceTarget: Math.round(perPieceTarget * 100) / 100,
        gpPct: c.gpPct, gpBaht: c.gpBaht, revenue: c.revenue, qtySold: c.qtySold,
        abcCompany: c.abcCompany,
        retailPrice: c.retailPrice, costSales: c.costSales,
        bundleCost: c.bundleCost,
        minSellPrice: c.minSellPrice,
        campaignGpPct: c.campaignGpPct,
        effectiveGpPct: c.effectiveGpPct,
        eligibleForTarget: c.eligibleForTarget,
        discountNeeded: c.discountNeeded,
        dataQuality: c.dataQuality,
        score: Math.round(score),
        reasons, warnings,
        hasExistingPromo: false,
      };
    });

    return scored
      .sort((a, b) => {
        if (a.eligibleForTarget !== b.eligibleForTarget) return a.eligibleForTarget ? -1 : 1;
        return b.score - a.score;
      })
      .slice(0, limit);
  }

  /**
   * Full product detail: cost, retail, GP + active promotions.
   * syncService is passed in to avoid a circular-dependency between ErpService and ErpSyncService.
   */
  async productDetail(sku: string, syncService: {
    // TypeORM returns decimal columns as strings, so accept string | number
    getCachedProduct(sku: string): Promise<{ productId: number; name: string; category: string; brand: string; retailPrice: number | string; costSales: number | string; imageUrl: string; abcCompany: string } | null>;
    getCachedSales(sku: string): Promise<{ revenue: number | string; qtySold: number; gpBaht: number | string; gpPct: number | string; periodDays: number } | null>;
  }) {
    const normalSku = sku.replace(/\s+/g, '').toUpperCase();

    const [cachedProd, cachedSales] = await Promise.all([
      syncService.getCachedProduct(normalSku),
      syncService.getCachedSales(normalSku),
    ]);

    // If not in cache, fall back to live ERP
    let productData: {
      id: number; sku: string; name: string; category: string; brand: string;
      retailPrice: number; costSales: number; imageUrl: string; abcCompany: string;
    } | undefined;

    if (cachedProd) {
      productData = {
        id: cachedProd.productId,
        sku: normalSku,
        name: cachedProd.name,
        category: cachedProd.category,
        brand: cachedProd.brand,
        retailPrice: Number(cachedProd.retailPrice),
        costSales: Number(cachedProd.costSales),
        imageUrl: cachedProd.imageUrl,
        abcCompany: cachedProd.abcCompany,
      };
    } else {
      const rows = await this.productsList({ q: sku, limit: 1 }, true);
      productData = rows[0];
    }

    const normalGpPct =
      productData && productData.retailPrice > 0 && productData.costSales > 0
        ? Math.round(
            ((productData.retailPrice - productData.costSales) / productData.retailPrice) * 1000,
          ) / 10
        : cachedSales?.gpPct ?? 0;

    // Fetch active promotions for this product
    let promotions: Array<{
      id: number; name: string; type: string; typeName?: string;
      promoPrice: number; retailPrice: number; conditions: string; remainingGpPct: number | null;
    }> = [];
    if (productData?.id) {
      try {
        const promoRows = await this.call<any[]>(
          'promotions',
          'by_product',
          { product_id: productData.id, active_only: 1 },
          false,
          30 * 60 * 1_000,
        );
        const cost = productData.costSales ?? 0;
        promotions = (promoRows ?? []).map((p: any) => {
          const promoPrice = num(p.promo_price ?? p.promotion_price ?? p.price ?? 0);
          const remainingGpPct =
            promoPrice > 0 && cost > 0
              ? Math.round(((promoPrice - cost) / promoPrice) * 1000) / 10
              : null;
          const conditions: string[] = [];
          if (p.min_qty)        conditions.push(`ซื้อขั้นต่ำ ${p.min_qty} ชิ้น`);
          if (p.min_amount)     conditions.push(`ขั้นต่ำ ฿${p.min_amount}`);
          if (p.free_item_qty)  conditions.push(`แถม ${p.free_item_qty} ชิ้น`);
          if (p.date_start && p.date_stop) conditions.push(`${p.date_start} – ${p.date_stop}`);
          return {
            id: num(p.id),
            name: String(p.promotion_name ?? p.name ?? ''),
            type: String(p.promotion_type ?? ''),
            typeName: String(p.promotion_type_name ?? ''),
            promoPrice,
            retailPrice: num(p.retail_price ?? p.price ?? 0),
            conditions: conditions.join(', ') || '—',
            remainingGpPct,
          };
        });
      } catch {
        // promotions are best-effort; don't fail the whole request
      }
    }

    return {
      sku: normalSku,
      productId: productData?.id ?? 0,
      name: productData?.name ?? sku,
      category: productData?.category ?? '',
      brand: productData?.brand ?? '',
      imageUrl: productData?.imageUrl ?? '',
      abcCompany: productData?.abcCompany ?? '',
      costPrice: productData?.costSales ?? 0,
      retailPrice: productData?.retailPrice ?? 0,
      normalGpPct,
      sales: cachedSales
        ? {
            revenue: Number(cachedSales.revenue),
            qtySold: cachedSales.qtySold,
            gpBaht: Number(cachedSales.gpBaht),
            gpPct: Number(cachedSales.gpPct),
            periodDays: cachedSales.periodDays,
          }
        : null,
      promotions,
    };
  }

  /** Aggregates category-level performance from topProducts */
  async categoryPerformance(from: string, to: string, force = false) {
    const products = await this.topProducts(from, to, 100, undefined, force);
    const map = new Map<string, { revenue: number; qtySold: number; gpSum: number; count: number }>();
    for (const p of products) {
      const cat = p.category || 'ไม่ระบุหมวด';
      const existing = map.get(cat) ?? { revenue: 0, qtySold: 0, gpSum: 0, count: 0 };
      existing.revenue  += p.revenue;
      existing.qtySold  += p.qtySold;
      existing.gpSum    += p.gpPct;
      existing.count    += 1;
      map.set(cat, existing);
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({
        category,
        revenue: v.revenue,
        qtySold: v.qtySold,
        productCount: v.count,
        gpPct: v.count > 0 ? Math.round((v.gpSum / v.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  // ---------- low-level HTTP (with cache) ----------

  private async call<T>(
    resource: string,
    action: string,
    params: Query = {},
    force = false,
    ttlMs = TTL_SALES,
  ): Promise<T> {
    const cacheKey = `${resource}:${action}:${JSON.stringify(params)}`;

    if (!force) {
      const cached = this.cacheGet<T>(cacheKey);
      if (cached !== undefined) {
        this.logger.debug(`ERP cache hit: ${cacheKey}`);
        return cached;
      }
    }

    const url = new URL(this.cfg.baseUrl);
    url.searchParams.set('resource', resource);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    if (this.cfg.apiKey) url.searchParams.set('api_key', this.cfg.apiKey);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`ERP HTTP ${res.status}`);
      }
      const json = (await res.json()) as ErpEnvelope<T>;
      if (!json.ok) {
        throw new Error('ERP responded ok=false');
      }
      this.cacheSet(cacheKey, json.data, ttlMs);
      return json.data;
    } catch (err) {
      this.logger.warn(`ERP call ${resource}/${action} failed: ${(err as Error).message}`);
      throw new AppException('erp.unavailable', HttpStatus.BAD_GATEWAY);
    } finally {
      clearTimeout(timer);
    }
  }
}
