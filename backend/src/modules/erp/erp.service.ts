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

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
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

  async campaignCandidates(params: {
    targetPrice: number;
    minGpPct: number;
    from: string;
    to: string;
    category?: number;
    abc?: string;
    limit?: number;
  }) {
    const limit = params.limit ?? 50;

    // Fetch products + sales in parallel
    const [salesRows, productRows] = await Promise.all([
      this.skuBranchSales(params.from, params.to, {
        category: params.category,
        abc: params.abc,
        limit: 200,
      }, false),
      this.productsList({
        category: params.category,
        abc: params.abc,
        limit: 500,
      }, false),
    ]);

    // Build product price map: sku → { retailPrice, costSales }
    const productMap = new Map<string, { retailPrice: number; costSales: number }>();
    for (const p of productRows) {
      productMap.set(p.sku, { retailPrice: p.retailPrice, costSales: p.costSales });
    }

    // Build a map: sku → aggregated sales across branches
    const salesMap = new Map<string, {
      sku: string;
      qtySold: number; revenue: number; gpBaht: number; gpPct: number;
      abcCompany: string; name: string; category: string; brand: string; productId: number;
    }>();
    for (const row of salesRows) {
      const existing = salesMap.get(row.sku);
      if (existing) {
        existing.qtySold += row.qtySold;
        existing.revenue += row.revenue;
        existing.gpBaht  += row.gpBaht;
        // keep the higher gpPct (approximate)
        if (row.gpPct > existing.gpPct) existing.gpPct = row.gpPct;
      } else {
        salesMap.set(row.sku, { ...row });
      }
    }

    // Filter by GP threshold
    const candidates = Array.from(salesMap.values()).filter(
      (s) => s.gpPct >= params.minGpPct,
    );

    // Score: GP weight + sales volume weight
    const maxRevenue = Math.max(...candidates.map((c) => c.revenue), 1);
    const scored = candidates.map((c) => {
      const prod = productMap.get(c.sku);
      const retailPrice = prod?.retailPrice ?? 0;
      const costSales   = prod?.costSales   ?? 0;

      // Suggested buffet price: cost / (1 − minGP%) rounded up to nearest 5 baht
      const rawSuggested = costSales > 0
        ? costSales / (1 - params.minGpPct / 100)
        : retailPrice;
      const suggestedBuffetPrice = rawSuggested > 0
        ? Math.ceil(rawSuggested / 5) * 5
        : 0;

      const fitsTargetPrice = retailPrice > 0 && retailPrice <= params.targetPrice;
      const discountNeeded  = retailPrice > params.targetPrice
        ? Math.round(((retailPrice - params.targetPrice) / retailPrice) * 100)
        : 0;

      const gpScore    = Math.min(c.gpPct / 100, 1) * 40;
      const salesScore = (c.revenue / maxRevenue) * 40;
      const abcBonus   = c.abcCompany === 'ACOM' ? 20 : c.abcCompany === 'BCOM' ? 10 : 0;
      const priceBonus = fitsTargetPrice ? 10 : 0;
      const score      = gpScore + salesScore + abcBonus + priceBonus;

      const reasons: string[] = [];
      if (c.gpPct >= 40)         reasons.push(`GP สูง ${c.gpPct.toFixed(0)}%`);
      else if (c.gpPct >= params.minGpPct) reasons.push(`GP ผ่านเกณฑ์ ${c.gpPct.toFixed(0)}%`);
      if (c.abcCompany === 'ACOM') reasons.push('สินค้า A (ขายดีมาก)');
      else if (c.abcCompany === 'BCOM') reasons.push('สินค้า B (ขายดี)');
      if (c.revenue > maxRevenue * 0.5) reasons.push('ยอดขายสูง');
      if (fitsTargetPrice) reasons.push(`ราคา ฿${retailPrice} เข้าเกณฑ์ Buffet`);

      const warnings: string[] = [];
      if (c.gpPct < params.minGpPct + 5) warnings.push('GP ใกล้ขีดต่ำสุด');
      if (!['ACOM', 'BCOM'].includes(c.abcCompany)) warnings.push('ยอดขายระดับ C/D');
      if (retailPrice > 0 && !fitsTargetPrice)
        warnings.push(`ราคา ฿${retailPrice} เกิน ฿${params.targetPrice} (ต้องลด ${discountNeeded}%)`);

      return {
        sku: c.sku,
        productId: c.productId,
        name: c.name,
        category: c.category,
        brand: c.brand,
        gpPct: c.gpPct,
        gpBaht: c.gpBaht,
        revenue: c.revenue,
        qtySold: c.qtySold,
        abcCompany: c.abcCompany,
        retailPrice,
        costSales,
        suggestedBuffetPrice,
        fitsTargetPrice,
        discountNeeded,
        score: Math.round(score),
        reasons,
        warnings,
        hasExistingPromo: false,
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
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
