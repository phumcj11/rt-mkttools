import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErpCampaignCache,
  ErpProductCache,
  ErpSalesDaily,
  ErpSalesSummary,
  ProductPromotionSnapshot,
  ProductSyncRun,
} from '../../database/entities';
import { ErpService } from './erp.service';

export interface ErpDailyPoint {
  date: string;
  orders: number;
  revenue: number;
}

export interface ErpAlert {
  level: 'success' | 'info' | 'warning';
  code: string;
  message: string;
  value?: number;
}

export interface SkuPromotionStepDto {
  campaignId: number;
  campaignCode: string | null;
  campaignName: string;
  promotionType: string | null;
  promotionTypeName: string | null;
  dateStart: string | null;
  dateStop: string | null;
  promoPrice: number;
  retailPrice: number;
  minQty: number;
  minAmount: number;
  freeItemQty: number;
  gp: number | null;
  stepText: string;
}

export interface SkuPromotionLookupResult {
  sku: string;
  productId: number | null;
  source: 'live' | 'cache' | 'live+cache' | 'none';
  items: SkuPromotionStepDto[];
}

@Injectable()
export class ErpSyncService {
  private readonly logger = new Logger(ErpSyncService.name);

  constructor(
    @InjectRepository(ErpSalesDaily)
    private readonly dailyRepo: Repository<ErpSalesDaily>,
    @InjectRepository(ErpProductCache)
    private readonly productCacheRepo: Repository<ErpProductCache>,
    @InjectRepository(ErpSalesSummary)
    private readonly salesSummaryRepo: Repository<ErpSalesSummary>,
    @InjectRepository(ProductPromotionSnapshot)
    private readonly promotionSnapshotRepo: Repository<ProductPromotionSnapshot>,
    @InjectRepository(ProductSyncRun)
    private readonly syncRunRepo: Repository<ProductSyncRun>,
    @InjectRepository(ErpCampaignCache)
    private readonly campaignCacheRepo: Repository<ErpCampaignCache>,
    private readonly erp: ErpService,
  ) {}

  /** ดึงยอดขายรายวันจาก ERP แล้ว upsert ลงฐานข้อมูลเรา (ค่าเริ่มต้น 90 วัน) */
  async sync(days = 90): Promise<{ synced: number; from: string; to: string }> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const fromStr = fmt(from);
    const toStr = fmt(to);

    const series = await this.erp.timeseries(fromStr, toStr, 'day');
    if (series.length === 0) return { synced: 0, from: fromStr, to: toStr };

    const rows = series.map((p) =>
      this.dailyRepo.create({
        saleDate: p.date,
        orders: Math.round(p.orders),
        revenue: p.revenue.toFixed(2),
      }),
    );
    await this.dailyRepo.upsert(rows, ['saleDate']);
    this.logger.log(`Synced ${rows.length} ERP daily rows (${fromStr} → ${toStr})`);
    return { synced: rows.length, from: fromStr, to: toStr };
  }

  /** อ่านประวัติยอดขายรายวันที่เก็บไว้ (ใหม่ → เก่า แล้วกลับลำดับให้เก่า → ใหม่) */
  async history(days = 90): Promise<ErpDailyPoint[]> {
    const rows = await this.dailyRepo.find({
      order: { saleDate: 'DESC' },
      take: days,
    });
    return rows
      .map((r) => ({
        date: typeof r.saleDate === 'string' ? r.saleDate.slice(0, 10) : String(r.saleDate),
        orders: Number(r.orders),
        revenue: Number(r.revenue),
      }))
      .reverse();
  }

  /** วิเคราะห์ความผิดปกติจากข้อมูลที่ sync ไว้ */
  async computeAlerts(): Promise<ErpAlert[]> {
    const history = await this.history(60);
    const alerts: ErpAlert[] = [];
    if (history.length < 8) return alerts;

    const latest = history[history.length - 1];
    const prev7 = history.slice(-8, -1);
    const avg7 = prev7.reduce((s, p) => s + p.revenue, 0) / prev7.length;

    if (avg7 > 0) {
      const diffPct = Math.round(((latest.revenue - avg7) / avg7) * 1000) / 10;
      if (diffPct <= -20) {
        alerts.push({
          level: 'warning',
          code: 'revenueDrop',
          value: Math.abs(diffPct),
          message: `ยอดขายวันล่าสุด (${latest.date}) ต่ำกว่าค่าเฉลี่ย 7 วัน ${Math.abs(diffPct)}% — ควรตรวจสอบสาเหตุ`,
        });
      } else if (diffPct >= 20) {
        alerts.push({
          level: 'success',
          code: 'revenueSpike',
          value: diffPct,
          message: `ยอดขายวันล่าสุด (${latest.date}) สูงกว่าค่าเฉลี่ย 7 วัน ${diffPct}% — โมเมนตัมดี`,
        });
      }
    }

    const maxRevenue = Math.max(...history.map((p) => p.revenue));
    if (latest.revenue >= maxRevenue && history.length >= 14) {
      alerts.push({
        level: 'info',
        code: 'recordHigh',
        message: `วันล่าสุดทำยอดขายสูงสุดในรอบ ${history.length} วันที่เก็บข้อมูล`,
      });
    }

    return alerts;
  }

  // ---------- Product + Sales Cache Sync ----------

  /** ดึง product master จาก ERP แล้ว upsert ลง erp_product_cache */
  async syncProducts(source = 'manual'): Promise<{
    synced: number;
    newCount: number;
    changedCount: number;
    inactiveCount: number;
  }> {
    const run = await this.syncRunRepo.save(this.syncRunRepo.create({
      status: 'running',
      source,
      startedAt: new Date(),
    }));

    try {
      this.logger.log('Starting ERP product cache sync...');
      const rows = await this.fetchAllProducts();
      if (rows.length === 0) {
        this.logger.warn('syncProducts: ERP returned 0 products');
        await this.finishRun(run, { status: 'success', totalCount: 0 });
        return { synced: 0, newCount: 0, changedCount: 0, inactiveCount: 0 };
      }

      const now = new Date();
      const incomingSkus = new Set(rows.map((p) => this.normalSku(p.sku)).filter(Boolean));
      const existing = await this.productCacheRepo.find();
      const existingBySku = new Map(existing.map((p) => [this.normalSku(p.sku), p]));

      let newCount = 0;
      let changedCount = 0;
      const entities = rows.map((p) => {
        const sku = this.normalSku(p.sku);
        const old = existingBySku.get(sku);
        const changeHash = this.productHash(p);
        const isNew = !old;
        const changed = !!old && old.changeHash !== changeHash;
        if (isNew) newCount += 1;
        if (changed) changedCount += 1;

        return this.productCacheRepo.create({
          sku,
          productId: p.id,
          name: p.name,
          category: p.category,
          brand: p.brand,
          retailPrice: p.retailPrice.toFixed(2),
          costSales: p.costSales.toFixed(2),
          imageUrl: p.imageUrl,
          abcCompany: p.abcCompany,
          firstSeenAt: old?.firstSeenAt ?? now,
          lastSeenAt: now,
          lastChangedAt: isNew || changed ? now : old?.lastChangedAt ?? now,
          isActive: true,
          changeHash,
        });
      });

      await this.productCacheRepo.upsert(entities, ['sku']);
      const missing = existing.filter((p) => !incomingSkus.has(this.normalSku(p.sku)) && p.isActive);
      if (missing.length > 0) {
        await this.productCacheRepo
          .createQueryBuilder()
          .update(ErpProductCache)
          .set({ isActive: false, lastSeenAt: now })
          .where('sku IN (:...skus)', { skus: missing.map((p) => p.sku) })
          .execute();
      }

      await this.finishRun(run, {
        status: 'success',
        totalCount: entities.length,
        newCount,
        changedCount,
        inactiveCount: missing.length,
      });
      this.logger.log(`syncProducts: upserted ${entities.length} products (${newCount} new, ${changedCount} changed, ${missing.length} inactive)`);
      return { synced: entities.length, newCount, changedCount, inactiveCount: missing.length };
    } catch (err) {
      await this.finishRun(run, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /** ดึง sales/by_sku_branch (ย้อนหลัง N วัน) aggregate แล้ว upsert ลง erp_sales_summary */
  async syncSalesSummary(days = 90): Promise<{ synced: number; from: string; to: string }> {
    this.logger.log(`Starting ERP sales summary sync (${days} days)…`);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const fromStr = fmt(from);
    const toStr = fmt(to);

    const salesRows = await this.fetchAllSkuBranchSales(fromStr, toStr);
    if (salesRows.length === 0) {
      this.logger.warn('syncSalesSummary: ERP returned 0 rows');
      return { synced: 0, from: fromStr, to: toStr };
    }

    // Aggregate by SKU across branches
    const normalSku = (s: string) => s.replace(/\s+/g, '').toUpperCase();
    const map = new Map<string, {
      sku: string; productId: number;
      revenue: number; qtySold: number; gpBaht: number;
      gpPctSum: number; rowCount: number; abcCompany: string;
    }>();
    for (const r of salesRows) {
      const key = normalSku(r.sku);
      const ex = map.get(key);
      if (ex) {
        ex.revenue  += r.revenue;
        ex.qtySold  += r.qtySold;
        ex.gpBaht   += r.gpBaht;
        ex.gpPctSum += r.gpPct;
        ex.rowCount += 1;
        if (!ex.abcCompany && r.abcCompany) ex.abcCompany = r.abcCompany;
      } else {
        map.set(key, {
          sku: r.sku, productId: r.productId,
          revenue: r.revenue, qtySold: r.qtySold,
          gpBaht: r.gpBaht, gpPctSum: r.gpPct, rowCount: 1,
          abcCompany: r.abcCompany,
        });
      }
    }

    const entities = Array.from(map.values()).map((v) =>
      this.salesSummaryRepo.create({
        sku: v.sku,
        productId: v.productId,
        revenue: v.revenue.toFixed(2),
        qtySold: v.qtySold,
        gpBaht: v.gpBaht.toFixed(2),
        gpPct: (v.rowCount > 0 ? v.gpPctSum / v.rowCount : 0).toFixed(2),
        abcCompany: v.abcCompany,
        periodDays: days,
      }),
    );
    await this.salesSummaryRepo.upsert(entities, ['sku']);
    this.logger.log(`syncSalesSummary: upserted ${entities.length} SKUs`);
    return { synced: entities.length, from: fromStr, to: toStr };
  }

  async syncPromotionSnapshots(limit = 1000): Promise<{ synced: number; failed: number }> {
    const products = await this.productCacheRepo.find({
      where: { isActive: true },
      order: { lastChangedAt: 'DESC', syncedAt: 'DESC' },
      take: Math.max(1, Math.min(limit, 5000)),
    });
    let synced = 0;
    let failed = 0;

    for (const product of products) {
      try {
        let promotions: Array<{
          id: number;
          name: string;
          type: string;
          typeName?: string;
          promoPrice: number;
          retailPrice: number;
          conditions: string;
          remainingGpPct: number | null;
        }> = [];

        if (product.productId > 0) {
          try {
            const byProduct = await this.erp.promotionsByProductDetail(product.productId, true);
            promotions = byProduct.map((p) => ({
              id: p.id,
              name: p.name,
              type: p.type,
              typeName: p.typeName,
              promoPrice: p.promoPrice,
              retailPrice: p.retailPrice,
              conditions: p.conditions || this.buildPromoStepText({
                promoPrice: p.promoPrice,
                minQty: p.minQty,
                freeItemQty: p.freeItemQty,
              }),
              remainingGpPct: p.remainingGpPct,
            }));
          } catch {
            // fall through to productDetail
          }
        }

        if (promotions.length === 0) {
          const detail = await this.erp.productDetail(product.sku, this);
          promotions = detail.promotions ?? [];
        }

        const promoPrices = promotions.map((p) => p.promoPrice).filter((v) => v > 0);
        const gpValues = promotions
          .map((p) => p.remainingGpPct)
          .filter((v): v is number => typeof v === 'number');

        await this.promotionSnapshotRepo.save(this.promotionSnapshotRepo.create({
          sku: product.sku,
          productId: product.productId,
          activePromotionCount: promotions.length,
          promotionNames: promotions.map((p) => p.name).filter(Boolean).join(' | ') || null,
          promotionTypes: promotions.map((p) => p.type || p.typeName).filter(Boolean).join(' | ') || null,
          lowestPromoPrice: promoPrices.length > 0 ? Math.min(...promoPrices).toFixed(2) : null,
          bestRemainingGpPct: gpValues.length > 0 ? Math.max(...gpValues).toFixed(2) : null,
          promotions,
        }));
        synced += 1;
      } catch (err) {
        failed += 1;
        this.logger.warn(`syncPromotionSnapshots: ${product.sku} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { synced, failed };
  }

  async syncProductMarketing(source = 'manual'): Promise<{
    products: Awaited<ReturnType<ErpSyncService['syncProducts']>>;
    sales: Awaited<ReturnType<ErpSyncService['syncSalesSummary']>>;
    promotions: Awaited<ReturnType<ErpSyncService['syncPromotionSnapshots']>>;
    campaigns: Awaited<ReturnType<ErpSyncService['syncCampaigns']>>;
  }> {
    const products = await this.syncProducts(source);
    const sales = await this.syncSalesSummary(90);
    const [promotions, campaigns] = await Promise.all([
      this.syncPromotionSnapshots(1000),
      this.syncCampaigns(),
    ]);
    const latestRun = await this.syncRunRepo.findOne({ order: { id: 'DESC' }, where: {} });
    if (latestRun) {
      latestRun.salesCount = sales.synced;
      latestRun.promotionCount = promotions.synced;
      await this.syncRunRepo.save(latestRun);
    }
    return { products, sales, promotions, campaigns };
  }

  /** คืนสถานะ cache ปัจจุบัน */
  async getCacheStatus(): Promise<{
    products: { count: number; syncedAt: Date | null };
    sales: { count: number; syncedAt: Date | null };
    promotions: { count: number; syncedAt: Date | null };
    campaigns: { count: number; syncedAt: Date | null };
    latestRun: ProductSyncRun | null;
  }> {
    const [productCount, salesCount, promotionCount, campaignCount] = await Promise.all([
      this.productCacheRepo.count(),
      this.salesSummaryRepo.count(),
      this.promotionSnapshotRepo.count(),
      this.campaignCacheRepo.count(),
    ]);

    const [lastProduct, lastSales, lastPromotion, lastCampaign, latestRun] = await Promise.all([
      productCount > 0
        ? this.productCacheRepo.findOne({ order: { syncedAt: 'DESC' }, where: {} })
        : Promise.resolve(null),
      salesCount > 0
        ? this.salesSummaryRepo.findOne({ order: { syncedAt: 'DESC' }, where: {} })
        : Promise.resolve(null),
      promotionCount > 0
        ? this.promotionSnapshotRepo.findOne({ order: { syncedAt: 'DESC' }, where: {} })
        : Promise.resolve(null),
      campaignCount > 0
        ? this.campaignCacheRepo.findOne({ order: { syncedAt: 'DESC' }, where: {} })
        : Promise.resolve(null),
      this.syncRunRepo.findOne({ order: { id: 'DESC' }, where: {} }),
    ]);

    return {
      products: { count: productCount, syncedAt: lastProduct?.syncedAt ?? null },
      sales: { count: salesCount, syncedAt: lastSales?.syncedAt ?? null },
      promotions: { count: promotionCount, syncedAt: lastPromotion?.syncedAt ?? null },
      campaigns: { count: campaignCount, syncedAt: lastCampaign?.syncedAt ?? null },
      latestRun,
    };
  }

  // ─── Campaign Cache ──────────────────────────────────────────────────────

  /** Build human-readable step label from ERP promo fields */
  private buildPromoStepText(p: {
    promoPrice: number;
    minQty: number;
    minAmount?: number;
    freeItemQty: number;
    conditions?: string;
    freeItemLabel?: string;
  }): string {
    if (p.conditions?.trim()) return p.conditions.trim();
    const minAmount = p.minAmount ?? 0;
    const minQty = p.minQty > 0 ? p.minQty : 0;
    if (minAmount > 0 && minQty > 1) {
      return `ซื้อครบ ${minQty} มูลค่า ฿${Math.round(minAmount)}`;
    }
    if (minAmount > 0 && p.freeItemQty > 0) {
      const gift = p.freeItemLabel ? ` ${p.freeItemLabel}` : '';
      return `ซื้อครบ ฿${Math.round(minAmount)} แถม${gift}`;
    }
    if (minAmount > 0) return `ซื้อครบ ฿${Math.round(minAmount)}`;
    if (p.freeItemQty > 0 && minQty > 0) return `ซื้อ ${minQty} แถม ${p.freeItemQty}`;
    if (minQty > 1 && p.promoPrice > 0) return `${minQty} ชิ้น ฿${Math.round(p.promoPrice)}`;
    if (p.promoPrice > 0) return `ราคาโปร ฿${Math.round(p.promoPrice)}`;
    return 'โปรพิเศษ';
  }

  private normalSku(sku: string) {
    return String(sku ?? '').replace(/\s+/g, '').toUpperCase();
  }

  /** Resolve product_id from local cache or live ERP products/list */
  async resolveProductIdBySku(sku: string): Promise<{ sku: string; productId: number } | null> {
    const normalSku = this.normalSku(sku);
    if (!normalSku) return null;

    const cached = await this.productCacheRepo.findOne({ where: { sku: normalSku } });
    if (cached?.productId) return { sku: normalSku, productId: cached.productId };

    const live = await this.erp.findProductBySku(normalSku, true);
    if (live?.id) return { sku: normalSku, productId: live.id };
    return null;
  }

  private mapStepDto(input: {
    campaignId: number;
    campaignCode?: string | null;
    campaignName: string;
    promotionType?: string | null;
    promotionTypeName?: string | null;
    dateStart?: string | null;
    dateStop?: string | null;
    promoPrice: number;
    retailPrice: number;
    minQty: number;
    minAmount: number;
    freeItemQty: number;
    gp?: number | null;
    stepText: string;
  }): SkuPromotionStepDto {
    return {
      campaignId: input.campaignId,
      campaignCode: input.campaignCode ?? null,
      campaignName: input.campaignName,
      promotionType: input.promotionType ?? null,
      promotionTypeName: input.promotionTypeName ?? null,
      dateStart: input.dateStart ?? null,
      dateStop: input.dateStop ?? null,
      promoPrice: input.promoPrice,
      retailPrice: input.retailPrice,
      minQty: input.minQty,
      minAmount: input.minAmount,
      freeItemQty: input.freeItemQty,
      gp: input.gp ?? null,
      stepText: input.stepText,
    };
  }

  /** Read cached promotions for SKU (snapshot + campaign product lists) */
  private async readCachedSkuPromotions(normalSku: string): Promise<SkuPromotionStepDto[]> {
    const results: SkuPromotionStepDto[] = [];

    const snapshot = await this.promotionSnapshotRepo.findOne({ where: { sku: normalSku } });
    const snapshotPromos = snapshot?.promotions ?? [];

    const allCampaigns = await this.campaignCacheRepo.find({ where: { isActive: true } });
    for (const campaign of allCampaigns) {
      if (!campaign.products) continue;
      const match = campaign.products.find(
        (p) => this.normalSku(p.sku) === normalSku,
      );
      if (!match) continue;
      results.push(this.mapStepDto({
        campaignId: campaign.campaignId,
        campaignCode: campaign.code,
        campaignName: campaign.name,
        promotionType: campaign.promotionType,
        promotionTypeName: campaign.promotionTypeName,
        dateStart: campaign.dateStart,
        dateStop: campaign.dateStop,
        promoPrice: match.promoPrice,
        retailPrice: match.retailPrice,
        minQty: match.minQty,
        minAmount: 0,
        freeItemQty: match.freeItemQty,
        gp: match.gp,
        stepText: match.stepText ?? this.buildPromoStepText({
          promoPrice: match.promoPrice,
          minQty: match.minQty,
          freeItemQty: match.freeItemQty,
          conditions: campaign.conditions ?? undefined,
        }),
      }));
    }

    for (const sp of snapshotPromos) {
      if (results.some((r) => r.campaignId === sp.id)) continue;
      const promoPrice = typeof sp.promoPrice === 'number' ? sp.promoPrice : 0;
      const retailPrice = typeof sp.retailPrice === 'number' ? sp.retailPrice : 0;
      results.push(this.mapStepDto({
        campaignId: sp.id,
        campaignCode: null,
        campaignName: sp.name,
        promotionType: sp.type ?? null,
        promotionTypeName: sp.typeName ?? null,
        dateStart: null,
        dateStop: null,
        promoPrice,
        retailPrice,
        minQty: 1,
        minAmount: 0,
        freeItemQty: 0,
        gp: typeof sp.remainingGpPct === 'number' ? sp.remainingGpPct : null,
        stepText: promoPrice > 0 ? `ราคาโปร ฿${Math.round(promoPrice)}` : sp.conditions ?? sp.name,
      }));
    }

    return results;
  }

  /** Fetch promotions for SKU directly from ERP promotions/by_product + detail */
  private async fetchLiveSkuPromotions(productId: number): Promise<SkuPromotionStepDto[]> {
    let promos = await this.erp.promotionsByProductDetail(productId, true, true);
    if (promos.length === 0) {
      promos = await this.erp.promotionsByProductDetail(productId, true, false);
    }
    const results: SkuPromotionStepDto[] = [];

    for (const promo of promos) {
      let detail: Awaited<ReturnType<ErpService['promotionDetail']>> = null;
      let freeItems: Awaited<ReturnType<ErpService['promotionFreeItems']>> = [];
      try {
        [detail, freeItems] = await Promise.all([
          this.erp.promotionDetail(promo.id, true),
          this.erp.promotionFreeItems(promo.id),
        ]);
      } catch {
        // detail/free_items are best-effort
      }

      const minQty = promo.minQty || detail?.minQty || 0;
      const minAmount = promo.minAmount || detail?.minAmount || 0;
      const freeItemQty = promo.freeItemQty || freeItems.reduce((s, f) => s + f.qty, 0);
      const freeItemLabel = freeItems.length > 0
        ? freeItems.map((f) => f.name || f.sku).filter(Boolean).slice(0, 2).join(', ')
        : undefined;

      const stepText = this.buildPromoStepText({
        promoPrice: promo.promoPrice || detail?.promoPrice || 0,
        minQty: minQty || 1,
        minAmount,
        freeItemQty,
        conditions: promo.conditions || detail?.conditions,
        freeItemLabel,
      });

      results.push(this.mapStepDto({
        campaignId: promo.id,
        campaignCode: promo.code || detail?.code || null,
        campaignName: promo.name || detail?.name || '',
        promotionType: promo.type || detail?.type || null,
        promotionTypeName: promo.typeName || detail?.typeName || null,
        dateStart: promo.dateStart || detail?.dateStart || null,
        dateStop: promo.dateStop || detail?.dateStop || null,
        promoPrice: promo.promoPrice || detail?.promoPrice || 0,
        retailPrice: promo.retailPrice || detail?.retailPrice || 0,
        minQty: minQty || 1,
        minAmount,
        freeItemQty,
        gp: promo.remainingGpPct,
        stepText,
      }));
    }

    return results;
  }

  private mergeSkuPromotionSteps(a: SkuPromotionStepDto[], b: SkuPromotionStepDto[]): SkuPromotionStepDto[] {
    const map = new Map<number, SkuPromotionStepDto>();
    for (const item of a) map.set(item.campaignId, item);
    for (const item of b) map.set(item.campaignId, item);
    return Array.from(map.values());
  }

  /** Persist promotion snapshot for a single SKU after live lookup */
  private async upsertPromotionSnapshotForSku(
    sku: string,
    productId: number,
    items: SkuPromotionStepDto[],
  ): Promise<void> {
    const promotions = items.map((s) => ({
      id: s.campaignId,
      name: s.campaignName,
      type: s.promotionType ?? '',
      typeName: s.promotionTypeName ?? '',
      promoPrice: s.promoPrice,
      retailPrice: s.retailPrice,
      conditions: s.stepText,
      remainingGpPct: s.gp,
    }));
    const promoPrices = promotions.map((p) => p.promoPrice).filter((v) => v > 0);
    const gpValues = promotions
      .map((p) => p.remainingGpPct)
      .filter((v): v is number => typeof v === 'number');

    await this.promotionSnapshotRepo.save(this.promotionSnapshotRepo.create({
      sku,
      productId,
      activePromotionCount: promotions.length,
      promotionNames: promotions.map((p) => p.name).filter(Boolean).join(' | ') || null,
      promotionTypes: promotions.map((p) => p.type || p.typeName).filter(Boolean).join(' | ') || null,
      lowestPromoPrice: promoPrices.length > 0 ? Math.min(...promoPrices).toFixed(2) : null,
      bestRemainingGpPct: gpValues.length > 0 ? Math.max(...gpValues).toFixed(2) : null,
      promotions,
    }));
  }

  /** On-demand sync promotion snapshot for one SKU */
  async syncPromotionSnapshotForSku(sku: string): Promise<SkuPromotionLookupResult> {
    return this.getSkuPromotions(sku);
  }

  /** Sync active campaigns from ERP promotions/list + detail + products + free_items */
  async syncCampaigns(): Promise<{ synced: number; failed: number }> {
    const campaigns = await this.erp.promotions(500, true);
    let synced = 0;
    let failed = 0;

    for (const campaign of campaigns) {
      try {
        const [detail, freeItems, products] = await Promise.all([
          this.erp.promotionDetail(campaign.id).catch(() => null),
          this.erp.promotionFreeItems(campaign.id).catch((): Awaited<ReturnType<ErpService['promotionFreeItems']>> => []),
          this.erp.promotionProducts(campaign.id).catch((): Awaited<ReturnType<ErpService['promotionProducts']>> => []),
        ]);

        const mapped = products.map((p) => {
          const gp = p.costSales > 0 && p.promoPrice > 0
            ? Math.round(((p.promoPrice - p.costSales) / p.promoPrice) * 1000) / 10
            : p.retailPrice > 0
              ? Math.round(((p.retailPrice - p.promoPrice) / p.retailPrice) * 1000) / 10
              : null;
          const freeQty = p.freeItemQty || freeItems.reduce((s, f) => s + f.qty, 0);
          const minAmount = detail?.minAmount ?? 0;
          const minQty = p.minQty || detail?.minQty || 1;
          const stepText = this.buildPromoStepText({
            promoPrice: p.promoPrice,
            minQty,
            minAmount,
            freeItemQty: freeQty,
            conditions: p.conditions || detail?.conditions,
            freeItemLabel: freeItems.map((f) => f.name).filter(Boolean).slice(0, 2).join(', ') || undefined,
          });
          return { ...p, freeItemQty: freeQty, gp, stepText };
        });

        await this.campaignCacheRepo.save(this.campaignCacheRepo.create({
          campaignId: campaign.id,
          code: detail?.code || campaign.code || null,
          name: detail?.name || campaign.name,
          promotionType: detail?.type || campaign.type || null,
          promotionTypeName: detail?.typeName || campaign.typeName || null,
          dateStart: detail?.dateStart || campaign.dateStart || null,
          dateStop: detail?.dateStop || campaign.dateStop || null,
          retailPrice: (detail?.retailPrice ?? campaign.retailPrice).toFixed(2),
          promoPrice: (detail?.promoPrice ?? campaign.promoPrice).toFixed(2),
          discountPct: (detail?.discountPct ?? campaign.discountPct).toFixed(2),
          isActive: true,
          productCount: mapped.length || campaign.productCount,
          conditions: detail?.conditions || null,
          freeItems: freeItems.length > 0 ? freeItems : null,
          products: mapped.length > 0 ? mapped : null,
        }));
        synced += 1;
      } catch (err) {
        failed += 1;
        this.logger.warn(`syncCampaigns: campaign ${campaign.id} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { synced, failed };
  }

  /** Read cached campaign list */
  async getCachedCampaigns(activeOnly = true): Promise<ErpCampaignCache[]> {
    if (activeOnly) {
      return this.campaignCacheRepo.find({ where: { isActive: true }, order: { syncedAt: 'DESC' } });
    }
    return this.campaignCacheRepo.find({ order: { syncedAt: 'DESC' } });
  }

  /** Read a single cached campaign with products */
  async getCachedCampaignDetail(campaignId: number): Promise<ErpCampaignCache | null> {
    return this.campaignCacheRepo.findOne({ where: { campaignId } });
  }

  /** Get promotions for SKU — live ERP lookup + cache merge + on-demand snapshot */
  async getSkuPromotions(sku: string): Promise<SkuPromotionLookupResult> {
    const normalSku = this.normalSku(sku);
    const cached = await this.readCachedSkuPromotions(normalSku);

    const resolved = await this.resolveProductIdBySku(normalSku);
    let live: SkuPromotionStepDto[] = [];
    if (resolved?.productId) {
      try {
        live = await this.fetchLiveSkuPromotions(resolved.productId);
      } catch (err) {
        this.logger.warn(
          `getSkuPromotions live fetch ${normalSku}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const items = this.mergeSkuPromotionSteps(cached, live);

    if (resolved?.productId && items.length > 0) {
      try {
        await this.upsertPromotionSnapshotForSku(normalSku, resolved.productId, items);
      } catch (err) {
        this.logger.warn(
          `getSkuPromotions snapshot upsert ${normalSku}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    let source: SkuPromotionLookupResult['source'] = 'none';
    if (live.length > 0 && cached.length > 0) source = 'live+cache';
    else if (live.length > 0) source = 'live';
    else if (cached.length > 0) source = 'cache';

    return {
      sku: normalSku,
      productId: resolved?.productId ?? null,
      source,
      items,
    };
  }

  /** อ่าน product cache ทั้งหมด (ใช้ใน campaignCandidates) */
  async getAllCachedProducts() {
    const rows = await this.productCacheRepo.find();
    return rows.map((r) => ({
      id: r.productId,
      sku: r.sku,
      name: r.name,
      category: r.category,
      brand: r.brand,
      retailPrice: Number(r.retailPrice),
      costSales: Number(r.costSales),
      imageUrl: r.imageUrl,
      abcCompany: r.abcCompany,
    }));
  }

  /** อ่าน sales summary ทั้งหมด (ใช้ใน campaignCandidates) */
  async getAllCachedSales() {
    const rows = await this.salesSummaryRepo.find();
    return rows.map((r) => ({
      sku: r.sku,
      productId: r.productId,
      revenue: Number(r.revenue),
      qtySold: r.qtySold,
      gpBaht: Number(r.gpBaht),
      gpPct: Number(r.gpPct),
      abcCompany: r.abcCompany,
      periodDays: r.periodDays,
    }));
  }

  /** อ่าน product cache ตาม SKU เดียว */
  async getCachedProduct(sku: string): Promise<ErpProductCache | null> {
    return this.productCacheRepo.findOne({ where: { sku } });
  }

  /** อ่าน sales summary ตาม SKU เดียว */
  async getCachedSales(sku: string): Promise<ErpSalesSummary | null> {
    return this.salesSummaryRepo.findOne({ where: { sku } });
  }

  private async fetchAllProducts() {
    // Use limit=200 (well below ERP's ~500-per-page server cap) so pagination
    // triggers correctly: if ERP caps at 500, requesting 200/page gives 200→200→100,
    // each < 200 on the last page signals end. With limit=1000 the cap of 500
    // looks like the last page and we never fetch page 2.
    const limit = 200;
    const all: Awaited<ReturnType<ErpService['productsList']>> = [];
    for (let page = 1; page <= 200; page += 1) {
      try {
        const rows = await this.fetchWithRetry(
          () => this.erp.productsList({ page, limit }, true),
          3,
        );
        all.push(...rows);
        if (rows.length < limit) break;
      } catch (err) {
        this.logger.warn(
          `fetchAllProducts page ${page} failed after retries: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        if (all.length === 0) throw err;
        break;
      }
    }
    return all;
  }

  /** Paginate sales/by_sku_branch — chunk by week, retry failures, continue on partial errors. */
  private async fetchAllSkuBranchSales(from: string, to: string) {
    type Row = Awaited<ReturnType<ErpService['skuBranchSales']>>[number];
    const limit = 200;
    const all: Row[] = [];

    // 7-day windows keep each ERP call small enough to finish within timeout
    const start = new Date(from);
    const end = new Date(to);
    const chunks: Array<{ from: string; to: string }> = [];
    let chunkStart = new Date(start);
    while (chunkStart <= end) {
      const chunkEnd = new Date(chunkStart);
      chunkEnd.setDate(chunkEnd.getDate() + 6);
      if (chunkEnd > end) chunkEnd.setTime(end.getTime());
      chunks.push({
        from: chunkStart.toISOString().slice(0, 10),
        to: chunkEnd.toISOString().slice(0, 10),
      });
      chunkStart = new Date(chunkEnd);
      chunkStart.setDate(chunkStart.getDate() + 1);
    }

    let failedChunks = 0;
    for (const chunk of chunks) {
      let chunkRows = 0;
      for (let page = 1; page <= 100; page += 1) {
        try {
          const rows = await this.fetchWithRetry(
            () => this.erp.skuBranchSales(chunk.from, chunk.to, { page, limit }, true),
            3,
          );
          all.push(...rows);
          chunkRows += rows.length;
          if (rows.length < limit) break;
        } catch (err) {
          this.logger.warn(
            `sales chunk ${chunk.from}–${chunk.to} page ${page} failed after retries: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          break;
        }
      }
      if (chunkRows === 0) failedChunks += 1;
    }

    if (failedChunks > 0 && all.length === 0) {
      throw new Error(`All ${chunks.length} sales chunks failed`);
    }
    if (failedChunks > 0) {
      this.logger.warn(`fetchAllSkuBranchSales: ${failedChunks}/${chunks.length} chunks returned no data`);
    }
    return all;
  }

  private async fetchWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    }
    throw lastErr;
  }

  private productHash(product: Awaited<ReturnType<ErpService['productsList']>>[number]) {
    return createHash('sha256')
      .update(JSON.stringify({
        sku: this.normalSku(product.sku),
        productId: product.id,
        name: product.name,
        category: product.category,
        brand: product.brand,
        retailPrice: product.retailPrice,
        costSales: product.costSales,
        imageUrl: product.imageUrl,
        abcCompany: product.abcCompany,
      }))
      .digest('hex');
  }

  private async finishRun(
    run: ProductSyncRun,
    patch: Partial<Pick<ProductSyncRun,
      'status' | 'totalCount' | 'newCount' | 'changedCount' | 'inactiveCount' | 'promotionCount' | 'salesCount' | 'error'
    >>,
  ) {
    Object.assign(run, patch, { finishedAt: new Date() });
    await this.syncRunRepo.save(run);
  }
}
