import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  BranchCustomerMixDaily,
  BranchTrafficDaily,
  ErpProductCache,
  ErpSalesSummary,
  SalesTarget,
} from '../../database/entities';
import { ErpService } from '../erp/erp.service';
import {
  BulkUpsertCustomerMixDto,
  BulkUpsertTargetsDto,
  BulkUpsertTrafficDto,
} from './dto/revenue.dto';

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

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const fmt = (d: Date) => d.toISOString().slice(0, 10);

const pctChange = (current: number, previous: number): number => {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

const branchStatus = (growthPct: number): BranchHealthStatus => {
  if (growthPct > 5) return 'green';
  if (growthPct >= -5) return 'yellow';
  return 'red';
};

@Injectable()
export class RevenueService {
  private readonly logger = new Logger(RevenueService.name);

  constructor(
    private readonly erp: ErpService,
    @InjectRepository(SalesTarget)
    private readonly targetRepo: Repository<SalesTarget>,
    @InjectRepository(BranchTrafficDaily)
    private readonly trafficRepo: Repository<BranchTrafficDaily>,
    @InjectRepository(BranchCustomerMixDaily)
    private readonly mixRepo: Repository<BranchCustomerMixDaily>,
    @InjectRepository(ErpProductCache)
    private readonly productCacheRepo: Repository<ErpProductCache>,
    @InjectRepository(ErpSalesSummary)
    private readonly salesCacheRepo: Repository<ErpSalesSummary>,
  ) {}

  private mtdRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return { from: fmt(from), to: fmt(to) };
  }

  private prevMonthSamePeriod(): { from: string; to: string } {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    const endDay = Math.min(dayOfMonth, lastDayPrevMonth);
    const prevEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), endDay);
    return { from: fmt(prevMonthStart), to: fmt(prevEnd) };
  }

  private yesterdayStr(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return fmt(d);
  }

  private currentYearMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  async commandCenter(tenantId: number, from?: string, to?: string, force = false) {
    const mtd = this.mtdRange();
    const prev = this.prevMonthSamePeriod();
    const yday = this.yesterdayStr();
    const rangeFrom = from ?? mtd.from;
    const rangeTo = to ?? mtd.to;

    const [
      dashboard,
      yesterdaySummary,
      mtdSummary,
      prevSummary,
      mtdBranches,
      prevBranches,
      timeseries,
      topProducts,
      categories,
      companyTarget,
      trafficRows,
      mixRows,
    ] = await Promise.all([
      this.erp.dashboardSummary(force),
      this.erp.salesSummary(yday, yday, undefined, force),
      this.erp.salesSummary(mtd.from, mtd.to, undefined, force),
      this.erp.salesSummary(prev.from, prev.to, undefined, force),
      this.erp.salesByBranch(mtd.from, mtd.to, force),
      this.erp.salesByBranch(prev.from, prev.to, force),
      this.erp.timeseries(rangeFrom, rangeTo, 'day', undefined, force),
      this.erp.topProducts(mtd.from, mtd.to, 20, undefined, force),
      this.erp.categoryPerformance(mtd.from, mtd.to, force),
      this.targetRepo.findOne({
        where: { tenantId, yearMonth: this.currentYearMonth(), branchId: IsNull() },
      }),
      this.trafficRepo.find({
        where: { tenantId },
        order: { trafficDate: 'DESC' },
        take: 500,
      }),
      this.mixRepo.find({
        where: { tenantId },
        order: { mixDate: 'DESC' },
        take: 500,
      }),
    ]);

    const targetConfigured = !!companyTarget;
    const targetRevenue = companyTarget ? num(companyTarget.targetRevenue) : null;
    const mtdRevenue = mtdSummary.revenue;
    const targetGap =
      targetRevenue !== null ? Math.round((targetRevenue - mtdRevenue) * 100) / 100 : null;

    const revenueGrowthPct = pctChange(mtdRevenue, prevSummary.revenue);
    const ordersGrowthPct = pctChange(mtdSummary.orders, prevSummary.orders);
    const avgTicketGrowthPct = pctChange(mtdSummary.avgTicket, prevSummary.avgTicket);

    const prevBranchMap = new Map(prevBranches.map((b) => [b.id, b]));
    const branches: BranchHealthRow[] = mtdBranches.map((b) => {
      const prevB = prevBranchMap.get(b.id);
      const prevRev = prevB?.revenue ?? 0;
      const prevOrd = prevB?.orders ?? 0;
      const prevAvg = prevB?.avgTicket ?? 0;
      const revGrowth = pctChange(b.revenue, prevRev);
      const ordGrowth = pctChange(b.orders, prevOrd);
      const avgGrowth = pctChange(b.avgTicket, prevAvg);
      const concernScore =
        Math.max(0, -revGrowth) * 2 +
        Math.max(0, -ordGrowth) +
        Math.max(0, -avgGrowth);
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        shortcode: b.shortcode,
        revenue: b.revenue,
        prevRevenue: prevRev,
        revenueGrowthPct: revGrowth,
        orders: b.orders,
        prevOrders: prevOrd,
        ordersGrowthPct: ordGrowth,
        avgTicket: b.avgTicket,
        prevAvgTicket: prevAvg,
        avgTicketGrowthPct: avgGrowth,
        status: branchStatus(revGrowth),
        concernScore,
      };
    });

    branches.sort((a, b) => b.revenue - a.revenue);
    const worstBranch =
      [...branches].sort((a, b) => b.concernScore - a.concernScore)[0] ?? null;

    const greenCount = branches.filter((b) => b.status === 'green').length;
    const yellowCount = branches.filter((b) => b.status === 'yellow').length;
    const redCount = branches.filter((b) => b.status === 'red').length;

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const remainingDays = Math.max(1, daysInMonth - dayOfMonth);
    const avgDailyOrders = dayOfMonth > 0 ? mtdSummary.orders / dayOfMonth : mtdSummary.orders;
    const expectedRemainingBills = Math.round(avgDailyOrders * remainingDays);
    const avgBillUpliftNeeded =
      targetGap !== null && targetGap > 0 && expectedRemainingBills > 0
        ? Math.round((targetGap / expectedRemainingBills) * 100) / 100
        : null;

    const { slowMoving, frontStoreCandidates } = await this.productActions();

    const diagnosis = this.buildDiagnosis({
      revenueGrowthPct,
      ordersGrowthPct,
      avgTicketGrowthPct,
      worstBranch,
      trafficRows,
      mixRows,
      targetConfigured,
      targetGap,
    });

    const trafficSummary = this.summarizeTraffic(trafficRows, mtd.from, mtd.to);
    const customerMixSummary = this.summarizeCustomerMix(mixRows, mtd.from, mtd.to);

    return {
      generatedAt: new Date().toISOString(),
      period: {
        from: rangeFrom,
        to: rangeTo,
        mtdFrom: mtd.from,
        mtdTo: mtd.to,
        prevFrom: prev.from,
        prevTo: prev.to,
        yesterday: yday,
      },
      kpi: {
        today: {
          revenue: dashboard.revenue.today,
          orders: dashboard.ordersToday,
        },
        yesterday: {
          revenue: yesterdaySummary.revenue,
          orders: yesterdaySummary.orders,
          avgTicket: yesterdaySummary.avgTicket,
        },
        mtd: {
          revenue: mtdRevenue,
          orders: mtdSummary.orders,
          avgTicket: mtdSummary.avgTicket,
        },
        prevPeriod: {
          revenue: prevSummary.revenue,
          orders: prevSummary.orders,
          avgTicket: prevSummary.avgTicket,
        },
        revenueGrowthPct,
        ordersGrowthPct,
        avgTicketGrowthPct,
        targetConfigured,
        targetRevenue,
        targetGap,
        benchmarkMode: !targetConfigured,
        avgBillUpliftNeeded,
        expectedRemainingBills,
      },
      branchHealth: {
        total: branches.length,
        green: greenCount,
        yellow: yellowCount,
        red: redCount,
        branches,
        worstBranch,
      },
      diagnosis,
      topProducts: topProducts.map((p) => ({
        sku: p.sku,
        name: p.name,
        category: p.category,
        brand: p.brand,
        revenue: p.revenue,
        qtySold: p.qtySold,
        gpPct: p.gpPct,
        abcCompany: p.abcCompany,
        imageUrl: p.imageUrl,
      })),
      categories,
      slowMoving,
      frontStoreCandidates,
      timeseries,
      traffic: trafficSummary,
      customerMix: customerMixSummary,
      billNearPromo: {
        available: false,
        message:
          'ต้องมีข้อมูลรายบิลจาก ERP (bucket เช่น 800-898, 900-998) — ยังไม่เชื่อม endpoint',
        buckets: [] as Array<{ label: string; count: number }>,
      },
    };
  }

  private buildDiagnosis(ctx: {
    revenueGrowthPct: number;
    ordersGrowthPct: number;
    avgTicketGrowthPct: number;
    worstBranch: BranchHealthRow | null;
    trafficRows: BranchTrafficDaily[];
    mixRows: BranchCustomerMixDaily[];
    targetConfigured: boolean;
    targetGap: number | null;
  }) {
    const items: Array<{ factor: string; severity: 'high' | 'medium' | 'low'; message: string }> =
      [];

    if (ctx.revenueGrowthPct < -5) {
      items.push({
        factor: 'revenue',
        severity: 'high',
        message: `ยอดขาย MTD ลด ${Math.abs(ctx.revenueGrowthPct)}% เทียบช่วงเดือนก่อน`,
      });
    } else if (ctx.revenueGrowthPct < 0) {
      items.push({
        factor: 'revenue',
        severity: 'medium',
        message: `ยอดขาย MTD ลดเล็กน้อย ${Math.abs(ctx.revenueGrowthPct)}% เทียบช่วงเดือนก่อน`,
      });
    }

    if (ctx.ordersGrowthPct < -5) {
      items.push({
        factor: 'traffic',
        severity: 'high',
        message: `จำนวนบิลลด ${Math.abs(ctx.ordersGrowthPct)}% — อาจเป็นปัญหา traffic หรือ conversion`,
      });
    } else if (ctx.ordersGrowthPct < 0 && ctx.avgTicketGrowthPct >= 0) {
      items.push({
        factor: 'conversion',
        severity: 'medium',
        message: 'บิลลดแต่ avg bill ทรงตัว/โต — เน้นกระตุ้น conversion และ foot traffic',
      });
    }

    if (ctx.avgTicketGrowthPct < -5) {
      items.push({
        factor: 'avg_bill',
        severity: 'high',
        message: `ค่าเฉลี่ยต่อบิลลด ${Math.abs(ctx.avgTicketGrowthPct)}% — ควรดันบิลและ upsell`,
      });
    }

    if (ctx.worstBranch && ctx.worstBranch.concernScore > 10) {
      items.push({
        factor: 'branch',
        severity: 'high',
        message: `สาขา "${ctx.worstBranch.name}" น่าห่วงที่สุด (ยอด ${ctx.worstBranch.revenueGrowthPct}%, บิล ${ctx.worstBranch.ordersGrowthPct}%)`,
      });
    }

    if (!ctx.targetConfigured) {
      items.push({
        factor: 'target',
        severity: 'low',
        message: 'ยังไม่ได้ตั้งเป้ายอดขาย — ใช้ช่วงเดือนก่อนเป็น benchmark ชั่วคราว',
      });
    } else if (ctx.targetGap !== null && ctx.targetGap > 0) {
      items.push({
        factor: 'target',
        severity: ctx.targetGap > 0 ? 'medium' : 'low',
        message: `ขาดเป้า MTD อีก ฿${Math.round(ctx.targetGap).toLocaleString('th-TH')}`,
      });
    }

    if (ctx.trafficRows.length === 0) {
      items.push({
        factor: 'data',
        severity: 'low',
        message: 'ยังไม่มีข้อมูล foot traffic — กรอก manual เพื่อวิเคราะห์ conversion ได้แม่นขึ้น',
      });
    }

    if (ctx.mixRows.length === 0) {
      items.push({
        factor: 'data',
        severity: 'low',
        message: 'ยังไม่มีข้อมูล customer mix — กรอก estimate รายสาขาเพื่อวางเกม offline',
      });
    }

    if (items.length === 0) {
      items.push({
        factor: 'overall',
        severity: 'low',
        message: 'ยอดขายอยู่ในเกณฑ์ดี — เน้นขยายสินค้าขายดีและทดสอบแคมเปญใหม่',
      });
    }

    return items;
  }

  private summarizeTraffic(rows: BranchTrafficDaily[], from: string, to: string) {
    const inRange = rows.filter((r) => r.trafficDate >= from && r.trafficDate <= to);
    const totalFoot = inRange.reduce((s, r) => s + r.footTraffic, 0);
    const totalTx = inRange.reduce((s, r) => s + (r.transactions ?? 0), 0);
    const conversionPct =
      totalFoot > 0 && totalTx > 0 ? Math.round((totalTx / totalFoot) * 10000) / 100 : null;
    return {
      available: inRange.length > 0,
      totalFootTraffic: totalFoot,
      totalTransactions: totalTx,
      conversionPct,
      entryCount: inRange.length,
      recent: inRange.slice(0, 20),
    };
  }

  private summarizeCustomerMix(rows: BranchCustomerMixDaily[], from: string, to: string) {
    const inRange = rows.filter((r) => r.mixDate >= from && r.mixDate <= to);
    const byType = new Map<string, number>();
    for (const r of inRange) {
      byType.set(r.customerType, (byType.get(r.customerType) ?? 0) + r.count);
    }
    const total = [...byType.values()].reduce((s, v) => s + v, 0);
    const breakdown = [...byType.entries()]
      .map(([type, count]) => ({
        customerType: type,
        count,
        pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);
    return {
      available: inRange.length > 0,
      total,
      breakdown,
      entryCount: inRange.length,
    };
  }

  private async productActions(): Promise<{
    slowMoving: ProductActionRow[];
    frontStoreCandidates: ProductActionRow[];
  }> {
    try {
      const products = await this.productCacheRepo.find({
        where: { isActive: true },
        take: 5000,
      });
      const sales = await this.salesCacheRepo.find();
      const salesMap = new Map(sales.map((s) => [s.sku, s]));

      const merged: ProductActionRow[] = products.map((p) => {
        const s = salesMap.get(p.sku);
        return {
          sku: p.sku,
          name: p.name,
          category: p.category,
          brand: p.brand,
          revenue: s ? num(s.revenue) : 0,
          qtySold: s?.qtySold ?? 0,
          gpPct: s ? num(s.gpPct) : 0,
          abcCompany: p.abcCompany || s?.abcCompany || '',
          imageUrl: p.imageUrl,
          retailPrice: num(p.retailPrice),
        };
      });

      const slowMoving = merged
        .filter((p) => p.qtySold <= 5)
        .sort((a, b) => a.qtySold - b.qtySold || a.revenue - b.revenue)
        .slice(0, 30);

      const frontStoreCandidates = merged
        .filter((p) => p.qtySold >= 10 && p.gpPct >= 15)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20);

      return { slowMoving, frontStoreCandidates };
    } catch (err) {
      this.logger.warn(`productActions failed: ${(err as Error).message}`);
      return { slowMoving: [], frontStoreCandidates: [] };
    }
  }

  async listTargets(tenantId: number, yearMonth?: string) {
    const where: { tenantId: number; yearMonth?: string } = { tenantId };
    if (yearMonth) where.yearMonth = yearMonth;
    return this.targetRepo.find({ where, order: { yearMonth: 'DESC', branchId: 'ASC' } });
  }

  async upsertTargets(tenantId: number, dto: BulkUpsertTargetsDto) {
    const saved: SalesTarget[] = [];
    for (const t of dto.targets) {
      const branchId = t.branchId ?? null;
      let row = await this.targetRepo.findOne({
        where: {
          tenantId,
          yearMonth: t.yearMonth,
          branchId: branchId === null ? IsNull() : branchId,
        },
      });
      if (!row) {
        row = this.targetRepo.create({ tenantId, yearMonth: t.yearMonth, branchId });
      }
      row.branchCode = t.branchCode ?? null;
      row.targetRevenue = String(t.targetRevenue);
      row.targetTransactions = t.targetTransactions ?? null;
      row.targetAvgTicket =
        t.targetAvgTicket != null ? String(t.targetAvgTicket) : null;
      row.notes = t.notes ?? null;
      saved.push(await this.targetRepo.save(row));
    }
    return saved;
  }

  async listTraffic(tenantId: number, from?: string, to?: string, branchId?: number) {
    const qb = this.trafficRepo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .orderBy('t.traffic_date', 'DESC');
    if (from) qb.andWhere('t.traffic_date >= :from', { from });
    if (to) qb.andWhere('t.traffic_date <= :to', { to });
    if (branchId) qb.andWhere('t.branch_id = :branchId', { branchId });
    return qb.getMany();
  }

  async upsertTraffic(tenantId: number, dto: BulkUpsertTrafficDto) {
    const saved: BranchTrafficDaily[] = [];
    for (const e of dto.entries) {
      let row = await this.trafficRepo.findOne({
        where: { tenantId, branchId: e.branchId, trafficDate: e.trafficDate },
      });
      if (!row) {
        row = this.trafficRepo.create({
          tenantId,
          branchId: e.branchId,
          trafficDate: e.trafficDate,
        });
      }
      row.branchCode = e.branchCode ?? null;
      row.footTraffic = e.footTraffic;
      row.transactions = e.transactions ?? null;
      row.notes = e.notes ?? null;
      row.source = e.source ?? 'manual';
      saved.push(await this.trafficRepo.save(row));
    }
    return saved;
  }

  async listCustomerMix(tenantId: number, from?: string, to?: string, branchId?: number) {
    const qb = this.mixRepo
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId', { tenantId })
      .orderBy('m.mix_date', 'DESC');
    if (from) qb.andWhere('m.mix_date >= :from', { from });
    if (to) qb.andWhere('m.mix_date <= :to', { to });
    if (branchId) qb.andWhere('m.branch_id = :branchId', { branchId });
    return qb.getMany();
  }

  async upsertCustomerMix(tenantId: number, dto: BulkUpsertCustomerMixDto) {
    const saved: BranchCustomerMixDaily[] = [];
    for (const e of dto.entries) {
      let row = await this.mixRepo.findOne({
        where: {
          tenantId,
          branchId: e.branchId,
          mixDate: e.mixDate,
          customerType: e.customerType,
        },
      });
      if (!row) {
        row = this.mixRepo.create({
          tenantId,
          branchId: e.branchId,
          mixDate: e.mixDate,
          customerType: e.customerType,
        });
      }
      row.branchCode = e.branchCode ?? null;
      row.count = e.count;
      row.pct = e.pct != null ? String(e.pct) : null;
      row.source = e.source ?? 'manual';
      saved.push(await this.mixRepo.save(row));
    }
    return saved;
  }
}
