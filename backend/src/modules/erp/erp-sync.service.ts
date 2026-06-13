import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
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

    const salesRows = await this.erp.skuBranchSales(fromStr, toStr, { limit: 5000 }, true);
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
        const detail = await this.erp.productDetail(product.sku, this);
        const promotions = detail.promotions ?? [];
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
  }> {
    const products = await this.syncProducts(source);
    const sales = await this.syncSalesSummary(90);
    const promotions = await this.syncPromotionSnapshots(1000);
    const latestRun = await this.syncRunRepo.findOne({ order: { id: 'DESC' }, where: {} });
    if (latestRun) {
      latestRun.salesCount = sales.synced;
      latestRun.promotionCount = promotions.synced;
      await this.syncRunRepo.save(latestRun);
    }
    return { products, sales, promotions };
  }

  /** คืนสถานะ cache ปัจจุบัน */
  async getCacheStatus(): Promise<{
    products: { count: number; syncedAt: Date | null };
    sales: { count: number; syncedAt: Date | null };
    promotions: { count: number; syncedAt: Date | null };
    latestRun: ProductSyncRun | null;
  }> {
    const [productCount, salesCount, promotionCount] = await Promise.all([
      this.productCacheRepo.count(),
      this.salesSummaryRepo.count(),
      this.promotionSnapshotRepo.count(),
    ]);

    const [lastProduct, lastSales, lastPromotion, latestRun] = await Promise.all([
      productCount > 0
        ? this.productCacheRepo.findOne({ order: { syncedAt: 'DESC' }, where: {} })
        : Promise.resolve(null),
      salesCount > 0
        ? this.salesSummaryRepo.findOne({ order: { syncedAt: 'DESC' }, where: {} })
        : Promise.resolve(null),
      promotionCount > 0
        ? this.promotionSnapshotRepo.findOne({ order: { syncedAt: 'DESC' }, where: {} })
        : Promise.resolve(null),
      this.syncRunRepo.findOne({ order: { id: 'DESC' }, where: {} }),
    ]);

    return {
      products: { count: productCount, syncedAt: lastProduct?.syncedAt ?? null },
      sales: { count: salesCount, syncedAt: lastSales?.syncedAt ?? null },
      promotions: { count: promotionCount, syncedAt: lastPromotion?.syncedAt ?? null },
      latestRun,
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
    const limit = 1000;
    const all: Awaited<ReturnType<ErpService['productsList']>> = [];
    for (let page = 1; page <= 100; page += 1) {
      const rows = await this.erp.productsList({ page, limit }, true);
      all.push(...rows);
      if (rows.length < limit) break;
    }
    return all;
  }

  private normalSku(sku: string) {
    return String(sku ?? '').replace(/\s+/g, '').toUpperCase();
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
