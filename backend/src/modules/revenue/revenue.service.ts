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
import { fmtLocalDate } from '../../common/utils/local-date';
import { OpenAiService } from '../ai/openai.service';
import { ErpService } from '../erp/erp.service';
import { ErpSyncService } from '../erp/erp-sync.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  branchMatchesActive,
  parseBranchCodes,
  REVENUE_ACTIVE_BRANCH_CODES_KEY,
} from './revenue-active-branches';
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
  // YoY
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

export interface CountryAnalyticsResponse {
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

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const fmt = fmtLocalDate;

const pctChange = (current: number, previous: number): number => {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

const pctChangeOrNull = (current: number, previous: number): number | null => {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

/** ERP มักคืนยอดย้อนหลัง 1 ปีไม่ครบ — ตรวจว่า YoY น่าเชื่อถือหรือไม่ */
const assessYoyReliability = (
  mtdRevenue: number,
  yoyRevenue: number,
  branches: Array<{ revenue: number; yoyRevenue: number }>,
): { reliable: boolean; message: string } => {
  if (mtdRevenue <= 0) {
    return { reliable: false, message: 'ยังไม่มียอด MTD' };
  }
  if (yoyRevenue <= 0) {
    return {
      reliable: false,
      message: 'ERP ไม่คืนยอดช่วงปีที่แล้ว — อาจยังไม่มีข้อมูลย้อนหลังครบ 1 ปี',
    };
  }
  const ratio = yoyRevenue / mtdRevenue;
  if (ratio < 0.25) {
    return {
      reliable: false,
      message: `ยอดปีที่แล้ว (฿${Math.round(yoyRevenue).toLocaleString('th-TH')}) ต่ำผิดปกติเทียบ MTD — ERP อาจส่งข้อมูลไม่ครบ`,
    };
  }
  const activeWithMtd = branches.filter((b) => b.revenue >= 100_000);
  if (activeWithMtd.length >= 3) {
    const missingYoy = activeWithMtd.filter((b) => b.yoyRevenue < b.revenue * 0.05).length;
    if (missingYoy / activeWithMtd.length >= 0.5) {
      return {
        reliable: false,
        message: 'ยอดรายสาขาปีที่แล้วไม่ครบ — แสดงเฉพาะสาขาที่มีข้อมูล',
      };
    }
  }
  return { reliable: true, message: '' };
};

const branchYoyReliable = (revenue: number, yoyRevenue: number, globalReliable: boolean): boolean => {
  if (!globalReliable) return yoyRevenue > 0 && yoyRevenue >= revenue * 0.05;
  return yoyRevenue > 0 || revenue < 100_000;
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
    private readonly erpSync: ErpSyncService,
    private readonly openai: OpenAiService,
    private readonly settings: SystemSettingsService,
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

  private prevYearSamePeriod(): { from: string; to: string } {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const yoyStart = new Date(today.getFullYear() - 1, today.getMonth(), 1);
    const lastDayYoy = new Date(today.getFullYear() - 1, today.getMonth() + 1, 0).getDate();
    const endDay = Math.min(dayOfMonth, lastDayYoy);
    const yoyEnd = new Date(today.getFullYear() - 1, today.getMonth(), endDay);
    return { from: fmt(yoyStart), to: fmt(yoyEnd) };
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

  async getActiveBranchCodes(): Promise<string[]> {
    const raw = await this.settings.get(REVENUE_ACTIVE_BRANCH_CODES_KEY);
    return parseBranchCodes(raw);
  }

  async setActiveBranchCodes(codes: string[]): Promise<string[]> {
    const normalized = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
    await this.settings.set(REVENUE_ACTIVE_BRANCH_CODES_KEY, normalized.join(','));
    return normalized;
  }

  async commandCenter(tenantId: number, from?: string, to?: string, force = false) {
    const activeCodes = await this.getActiveBranchCodes();
    const activeSet = new Set(activeCodes);
    const mtd = this.mtdRange();
    const prev = this.prevMonthSamePeriod();
    const yoy = this.prevYearSamePeriod();
    const yday = this.yesterdayStr();
    const rangeFrom = from ?? mtd.from;
    const rangeTo = to ?? mtd.to;

    const [
      dashboard,
      yesterdaySummary,
      mtdSummary,
      prevSummary,
      yoySummary,
      mtdBranchesRaw,
      prevBranchesRaw,
      yoyBranchesRaw,
      erpBranches,
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
      this.erp.salesSummary(yoy.from, yoy.to, undefined, force),
      this.erp.salesByBranch(mtd.from, mtd.to, force),
      this.erp.salesByBranch(prev.from, prev.to, force),
      this.erp.salesByBranch(yoy.from, yoy.to, force),
      this.erp.branches(force),
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

    const mtdBranches = mtdBranchesRaw.filter((b) => branchMatchesActive(b, activeSet));
    const prevBranches = prevBranchesRaw.filter((b) => branchMatchesActive(b, activeSet));
    const yoyBranches = yoyBranchesRaw.filter((b) => branchMatchesActive(b, activeSet));
    const activeBranches = erpBranches
      .filter((b) => branchMatchesActive(b, activeSet))
      .map((b) => ({
        id: b.id,
        code: b.code,
        shortcode: b.shortcode,
        name: b.name,
      }))
      .sort((a, b) => a.shortcode.localeCompare(b.shortcode));

    const targetConfigured = !!companyTarget;
    const targetRevenue = companyTarget ? num(companyTarget.targetRevenue) : null;
    const mtdRevenue = mtdSummary.revenue;
    const targetGap =
      targetRevenue !== null ? Math.round((targetRevenue - mtdRevenue) * 100) / 100 : null;

    const revenueGrowthPct = pctChange(mtdRevenue, prevSummary.revenue);
    const ordersGrowthPct = pctChange(mtdSummary.orders, prevSummary.orders);
    const avgTicketGrowthPct = pctChange(mtdSummary.avgTicket, prevSummary.avgTicket);

    const prevBranchMap = new Map(prevBranches.map((b) => [b.id, b]));
    const yoyBranchMap = new Map(yoyBranches.map((b) => [b.id, b]));

    // Resolve YoY company totals — ERP มักคืนยอดย้อนหลังไม่ครบ
    let yoyPeriodRevenue = yoySummary.revenue;
    let yoyPeriodOrders = yoySummary.orders;
    let yoyPeriodAvgTicket = yoySummary.avgTicket;
    let yoySource: 'erp_live' | 'daily_cache' = 'erp_live';

    const prelimYoyBranches = mtdBranches.map((b) => ({
      revenue: b.revenue,
      yoyRevenue: yoyBranchMap.get(b.id)?.revenue ?? 0,
    }));
    let yoyAssessment = assessYoyReliability(mtdRevenue, yoyPeriodRevenue, prelimYoyBranches);

    if (!yoyAssessment.reliable) {
      try {
        const expectedDays = new Date().getDate();
        await this.erpSync.syncDateRange(yoy.from, yoy.to, force);
        const dailyAgg = await this.erpSync.aggregateDailyRange(yoy.from, yoy.to);
        const coverageOk = dailyAgg.days >= Math.max(3, Math.floor(expectedDays * 0.5));
        const ratioOk = dailyAgg.revenue >= mtdRevenue * 0.25;
        if (coverageOk && ratioOk) {
          yoyPeriodRevenue = dailyAgg.revenue;
          yoyPeriodOrders = dailyAgg.orders;
          yoyPeriodAvgTicket = dailyAgg.orders > 0 ? dailyAgg.revenue / dailyAgg.orders : 0;
          yoySource = 'daily_cache';
          yoyAssessment = assessYoyReliability(mtdRevenue, yoyPeriodRevenue, prelimYoyBranches);
          this.logger.log(
            `YoY company totals from daily cache: ${yoy.from}→${yoy.to} revenue=${Math.round(yoyPeriodRevenue)} (${dailyAgg.days} days)`,
          );
        } else {
          this.logger.warn(
            `YoY daily cache insufficient: ${dailyAgg.days}/${expectedDays} days, revenue=${Math.round(dailyAgg.revenue)} vs mtd=${Math.round(mtdRevenue)}`,
          );
        }
      } catch (err) {
        this.logger.warn(`YoY daily backfill failed: ${(err as Error).message}`);
      }
    }

    const yoyReliable = yoyAssessment.reliable;
    const yoyMessage = yoyAssessment.message;
    const yoyRevenueGrowthPct = yoyReliable
      ? pctChangeOrNull(mtdRevenue, yoyPeriodRevenue)
      : null;
    const yoyOrdersGrowthPct = yoyReliable
      ? pctChangeOrNull(mtdSummary.orders, yoyPeriodOrders)
      : null;
    const yoyAvgTicketGrowthPct = yoyReliable
      ? pctChangeOrNull(mtdSummary.avgTicket, yoyPeriodAvgTicket)
      : null;

    const branches: BranchHealthRow[] = mtdBranches.map((b) => {
      const prevB = prevBranchMap.get(b.id);
      const prevRev = prevB?.revenue ?? 0;
      const prevOrd = prevB?.orders ?? 0;
      const prevAvg = prevB?.avgTicket ?? 0;
      const revGrowth = pctChange(b.revenue, prevRev);
      const ordGrowth = pctChange(b.orders, prevOrd);
      const avgGrowth = pctChange(b.avgTicket, prevAvg);
      const yoyB = yoyBranchMap.get(b.id);
      const yoyRev = yoyB?.revenue ?? 0;
      const yoyOrd = yoyB?.orders ?? 0;
      const yoyAvg = yoyB?.avgTicket ?? 0;
      const branchReliable = yoyReliable && branchYoyReliable(b.revenue, yoyRev, yoyReliable);
      const concernScore =
        Math.max(0, -(revGrowth ?? 0)) * 2 +
        Math.max(0, -(ordGrowth ?? 0)) +
        Math.max(0, -(avgGrowth ?? 0));
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
        yoyRevenue: yoyRev,
        yoyRevenueGrowthPct: branchReliable ? pctChangeOrNull(b.revenue, yoyRev) : null,
        yoyOrders: yoyOrd,
        yoyOrdersGrowthPct: branchReliable ? pctChangeOrNull(b.orders, yoyOrd) : null,
        yoyAvgTicket: yoyAvg,
        yoyAvgTicketGrowthPct: branchReliable ? pctChangeOrNull(b.avgTicket, yoyAvg) : null,
        yoyReliable: branchReliable,
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
        yoyFrom: yoy.from,
        yoyTo: yoy.to,
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
        yoyPeriod: {
          revenue: yoyPeriodRevenue,
          orders: yoyPeriodOrders,
          avgTicket: yoyPeriodAvgTicket,
        },
        revenueGrowthPct,
        ordersGrowthPct,
        avgTicketGrowthPct,
        yoyRevenueGrowthPct,
        yoyOrdersGrowthPct,
        yoyAvgTicketGrowthPct,
        yoyReliable,
        yoyMessage,
        yoySource,
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
      activeBranchCodes: activeCodes,
      activeBranches,
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

  async countryAnalytics(
    tenantId: number,
    from?: string,
    to?: string,
    country = 'Thailand',
    force = false,
  ): Promise<CountryAnalyticsResponse> {
    void tenantId;
    const mtd = this.mtdRange();
    const range = { from: from || mtd.from, to: to || mtd.to };
    const selectedCountry = country?.trim() || 'Thailand';

    const [countryProbe, receiptProbe] = await Promise.all([
      this.erp.customerCountrySales(range.from, range.to, 30, force),
      this.erp.receiptLines(range.from, range.to, { country: selectedCountry, limit: 5000 }, force),
    ]);

    const warnings: string[] = [];
    const missingFields = new Set<string>([
      ...countryProbe.missingFields,
      ...receiptProbe.missingFields,
    ]);
    if (countryProbe.message) warnings.push(countryProbe.message);
    if (receiptProbe.message) warnings.push(receiptProbe.message);

    const lineCountries = this.countrySummaryFromReceiptLines(receiptProbe.data);
    const rawCountries = countryProbe.data.length > 0 ? countryProbe.data : lineCountries;
    const totalRevenue = rawCountries.reduce((s, r) => s + r.revenue, 0);
    const countries = rawCountries
      .map((r) => ({
        ...r,
        revenueSharePct: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const selectedCountryLower = selectedCountry.toLowerCase();
    const countryRow =
      countries.find((r) => r.country.toLowerCase() === selectedCountryLower) ??
      countries.find((r) => r.country.toLowerCase().includes(selectedCountryLower)) ??
      null;

    const lines = receiptProbe.data;
    const topProducts = this.topProductsFromReceiptLines(lines);
    const basketPairs = this.basketPairsFromReceiptLines(lines);
    const receiptCount = new Set(lines.map((l) => l.receiptNo)).size;

    const selectedCountrySummary = {
      country: countryRow?.country ?? selectedCountry,
      orders: countryRow?.orders ?? receiptCount,
      revenue: countryRow?.revenue ?? lines.reduce((s, l) => s + l.revenue, 0),
      avgTicket:
        countryRow?.avgTicket ??
        (receiptCount > 0 ? lines.reduce((s, l) => s + l.revenue, 0) / receiptCount : 0),
      receiptCount,
    };

    const reliable = countryProbe.supported || receiptProbe.supported;
    if (!countryProbe.supported && !receiptProbe.supported) {
      warnings.push(
        'ต้องมี ERP endpoint สำหรับประเทศลูกค้าและรายการสินค้าในบิลเดียวกันก่อน จึงจะวิเคราะห์ได้แม่นยำ',
      );
    } else if (!receiptProbe.supported) {
      warnings.push('ยังวิเคราะห์สินค้าซื้อคู่กันไม่ได้ เพราะ ERP ไม่คืนรายการสินค้าในบิลเดียวกัน');
    } else if (!countryProbe.supported) {
      warnings.push('Country leaderboard คำนวณจาก receipt lines เท่านั้น เพราะ ERP ไม่มี endpoint สรุปประเทศโดยตรง');
    }

    const aiSummary = await this.buildCountryAiSummary({
      reliable,
      warnings,
      selectedCountry: selectedCountrySummary.country,
      countries,
      topProducts,
      basketPairs,
    });

    return {
      generatedAt: new Date().toISOString(),
      period: range,
      selectedCountry,
      dataQuality: {
        reliable,
        countrySource: countryProbe.source,
        receiptLineSource: receiptProbe.source,
        missingFields: [...missingFields],
        warnings: [...new Set(warnings)],
      },
      countries,
      selectedCountrySummary,
      topProducts,
      basketPairs,
      aiSummary,
    };
  }

  private countrySummaryFromReceiptLines(lines: Array<{
    customerCountry: string;
    receiptNo: string;
    revenue: number;
  }>) {
    const map = new Map<string, { country: string; receiptSet: Set<string>; revenue: number }>();
    for (const l of lines) {
      const country = l.customerCountry || 'ไม่ระบุประเทศ';
      const row = map.get(country) ?? { country, receiptSet: new Set<string>(), revenue: 0 };
      row.receiptSet.add(l.receiptNo);
      row.revenue += l.revenue;
      map.set(country, row);
    }
    return [...map.values()].map((r) => ({
      country: r.country,
      orders: r.receiptSet.size,
      revenue: Math.round(r.revenue * 100) / 100,
      avgTicket: r.receiptSet.size > 0 ? Math.round((r.revenue / r.receiptSet.size) * 100) / 100 : 0,
      customers: 0,
    }));
  }

  private topProductsFromReceiptLines(lines: Array<{
    receiptNo: string;
    sku: string;
    productName: string;
    category: string;
    qty: number;
    revenue: number;
  }>) {
    const map = new Map<string, {
      sku: string;
      name: string;
      category: string;
      qty: number;
      revenue: number;
      receiptSet: Set<string>;
    }>();
    for (const l of lines) {
      const row = map.get(l.sku) ?? {
        sku: l.sku,
        name: l.productName || l.sku,
        category: l.category,
        qty: 0,
        revenue: 0,
        receiptSet: new Set<string>(),
      };
      row.qty += l.qty;
      row.revenue += l.revenue;
      row.receiptSet.add(l.receiptNo);
      map.set(l.sku, row);
    }
    return [...map.values()]
      .map((r) => ({
        sku: r.sku,
        name: r.name,
        category: r.category,
        qty: Math.round(r.qty * 100) / 100,
        revenue: Math.round(r.revenue * 100) / 100,
        receiptCount: r.receiptSet.size,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);
  }

  private basketPairsFromReceiptLines(lines: Array<{
    receiptNo: string;
    sku: string;
    productName: string;
    revenue: number;
  }>) {
    const byReceipt = new Map<string, Map<string, { sku: string; name: string; revenue: number }>>();
    for (const l of lines) {
      const receipt = byReceipt.get(l.receiptNo) ?? new Map();
      const row = receipt.get(l.sku) ?? { sku: l.sku, name: l.productName || l.sku, revenue: 0 };
      row.revenue += l.revenue;
      receipt.set(l.sku, row);
      byReceipt.set(l.receiptNo, receipt);
    }

    const pairMap = new Map<string, {
      leftSku: string;
      leftName: string;
      rightSku: string;
      rightName: string;
      receiptCount: number;
      revenue: number;
    }>();

    for (const receipt of byReceipt.values()) {
      const items = [...receipt.values()].sort((a, b) => a.sku.localeCompare(b.sku));
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const left = items[i];
          const right = items[j];
          const key = `${left.sku}::${right.sku}`;
          const row = pairMap.get(key) ?? {
            leftSku: left.sku,
            leftName: left.name,
            rightSku: right.sku,
            rightName: right.name,
            receiptCount: 0,
            revenue: 0,
          };
          row.receiptCount += 1;
          row.revenue += left.revenue + right.revenue;
          pairMap.set(key, row);
        }
      }
    }

    const receiptCount = byReceipt.size;
    return [...pairMap.values()]
      .map((r) => ({
        ...r,
        revenue: Math.round(r.revenue * 100) / 100,
        supportPct: receiptCount > 0 ? Math.round((r.receiptCount / receiptCount) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.receiptCount - a.receiptCount || b.revenue - a.revenue)
      .slice(0, 15);
  }

  private async buildCountryAiSummary(ctx: {
    reliable: boolean;
    warnings: string[];
    selectedCountry: string;
    countries: CountryAnalyticsResponse['countries'];
    topProducts: CountryAnalyticsResponse['topProducts'];
    basketPairs: CountryAnalyticsResponse['basketPairs'];
  }): Promise<CountryAnalyticsResponse['aiSummary']> {
    if (!ctx.reliable) {
      return {
        available: false,
        source: 'none',
        text: ctx.warnings[0] ?? 'ยังไม่มีข้อมูลเพียงพอสำหรับ AI summary',
      };
    }

    const facts = {
      selectedCountry: ctx.selectedCountry,
      topCountries: ctx.countries.slice(0, 5),
      topProducts: ctx.topProducts.slice(0, 5),
      basketPairs: ctx.basketPairs.slice(0, 5),
    };

    try {
      const result = await this.openai.complete(
        'You are a retail revenue analyst. Summarize only from the provided facts. Reply in Thai with 3 concise bullet recommendations.',
        JSON.stringify(facts),
      );
      if (result.content) {
        return { available: true, source: 'openai', text: result.content };
      }
    } catch (err) {
      this.logger.warn(`Country AI summary failed: ${(err as Error).message}`);
    }

    const topCountry = ctx.countries[0];
    const topProduct = ctx.topProducts[0];
    const topPair = ctx.basketPairs[0];
    const parts = [
      topCountry
        ? `ประเทศที่ทำยอดสูงสุดคือ ${topCountry.country} ยอด ฿${Math.round(topCountry.revenue).toLocaleString('th-TH')}`
        : '',
      topProduct
        ? `${ctx.selectedCountry} ซื้อ ${topProduct.name} สูงสุด ยอด ฿${Math.round(topProduct.revenue).toLocaleString('th-TH')}`
        : '',
      topPair
        ? `คู่สินค้าที่ควรทำ bundle คือ ${topPair.leftName} + ${topPair.rightName} พบใน ${topPair.receiptCount} บิล`
        : '',
    ].filter(Boolean);

    return {
      available: parts.length > 0,
      source: 'heuristic',
      text: parts.length > 0 ? parts.map((p) => `- ${p}`).join('\n') : 'ยังไม่มีข้อมูลเพียงพอสำหรับสรุป insight',
    };
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
