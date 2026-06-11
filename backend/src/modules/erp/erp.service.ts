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

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

@Injectable()
export class ErpService {
  private readonly logger = new Logger(ErpService.name);
  private readonly cfg: ErpConfig;

  constructor(private readonly config: ConfigService) {
    this.cfg = this.config.getOrThrow<ErpConfig>('erp');
  }

  // ---------- public API (normalized) ----------

  async dashboardSummary() {
    const d = await this.call<any>('dashboard', 'summary');
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

  async salesSummary(from: string, to: string, branchId?: number) {
    const d = await this.call<any>('sales', 'summary', { from, to, branch_id: branchId });
    const row = Array.isArray(d) ? d[0] : d;
    return {
      orders: num(row?.orders),
      revenue: num(row?.revenue),
      gross: num(row?.gross),
      discount: num(row?.discount),
      avgTicket: num(row?.avg_ticket),
    };
  }

  async salesByBranch(from: string, to: string) {
    const d = await this.call<any[]>('sales', 'by_branch', { from, to });
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

  async topProducts(from: string, to: string, limit = 10, branchId?: number) {
    const d = await this.call<any[]>('sales', 'top_products', {
      from,
      to,
      limit,
      branch_id: branchId,
    });
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

  async timeseries(from: string, to: string, bucket: 'day' | 'week' | 'month', branchId?: number) {
    const d = await this.call<any[]>('sales', 'timeseries', {
      from,
      to,
      bucket,
      branch_id: branchId,
    });
    return (d ?? []).map((t) => ({
      date: String(t.d),
      revenue: num(t.revenue),
      orders: num(t.orders),
    }));
  }

  async branches() {
    const d = await this.call<any[]>('branches', 'list', {
      exclude_internal: 1,
      status: 'ACTIVE',
    });
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

  async topBuyers(from: string, to: string, limit = 10) {
    const d = await this.call<any[]>('customers', 'top_buyers', { from, to, limit });
    return (d ?? []).map((c) => ({
      id: num(c.id),
      code: String(c.code ?? ''),
      name: String(c.name ?? ''),
      orders: num(c.orders),
      revenue: num(c.revenue),
      avgTicket: num(c.avg_ticket),
    }));
  }

  async promotions(limit = 20) {
    const d = await this.call<any[]>('promotions', 'list', { active_only: 1, limit });
    return (d ?? []).map((p) => ({
      id: num(p.id),
      code: String(p.code ?? ''),
      name: String(p.promotion_name ?? p.name ?? ''),
      type: String(p.promotion_type ?? ''),
      typeName: String(p.promotion_type_name ?? ''),
      dateStart: String(p.date_start ?? ''),
      dateStop: String(p.date_stop ?? ''),
      price: num(p.price),
      productCount: num(p.product_count),
      freeItemCount: num(p.free_item_count),
    }));
  }

  // ---------- low-level HTTP ----------

  private async call<T>(resource: string, action: string, params: Query = {}): Promise<T> {
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
      return json.data;
    } catch (err) {
      this.logger.warn(`ERP call ${resource}/${action} failed: ${(err as Error).message}`);
      throw new AppException('erp.unavailable', HttpStatus.BAD_GATEWAY);
    } finally {
      clearTimeout(timer);
    }
  }
}
