import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import {
  BranchCustomerMixDaily,
  BranchStorefrontActivity,
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
import { PosSalesImportService, type PosBranchInsight } from './pos-sales-import.service';

export type BranchHealthStatus = 'green' | 'yellow' | 'red';
export type BranchMarketingStatus =
  | 'critical'
  | 'watch'
  | 'recovering'
  | 'aboveTarget'
  | 'billDrop'
  | 'avgDrop'
  | 'healthy';
export type BranchRootCause =
  | 'traffic'
  | 'upsell'
  | 'trafficAndUpsell'
  | 'smallBasket'
  | 'targetRisk'
  | 'healthy';

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
  targetRevenue?: number | null;
  targetSource?: 'branch' | 'allocated' | 'none';
  targetAchievementPct?: number | null;
  forecastRevenue?: number;
  forecastGap?: number | null;
  dailyGapToTarget?: number | null;
  footTraffic?: number | null;
  conversionPct?: number | null;
  campaignBills?: number;
  campaignConversionPct?: number | null;
  billTierCounts?: Record<string, number>;
  topNationalities?: Array<{ nationality: string; receipts: number; revenue: number }>;
  topProducts?: Array<{ sku: string; name: string; qty: number; revenue: number }>;
  topPromotions?: Array<{ promotionName: string; receipts: number; revenue: number }>;
  marketingStatus?: BranchMarketingStatus;
  rootCause?: BranchRootCause;
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

export interface BranchCountryAnalyticsResponse {
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

export interface BranchCountryProductsResponse {
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

export interface BranchAiAnalysisResponse {
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
  marketing: {
    targetRevenue: number | null;
    targetAchievementPct: number | null;
    forecastRevenue: number;
    forecastGap: number | null;
    dailyGapToTarget: number | null;
    marketingStatus: BranchMarketingStatus;
    rootCause: BranchRootCause;
    campaignBills: number;
    campaignConversionPct: number | null;
    billTierCounts: Record<string, number>;
    topNationalities: Array<{ nationality: string; receipts: number; revenue: number }>;
    topPromotions: Array<{ promotionName: string; receipts: number; revenue: number }>;
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
  private readonly branchAiCache = new Map<
    string,
    { result: BranchAiAnalysisResponse; expiry: number }
  >();
  private readonly BRANCH_AI_TTL_MS = 20 * 60 * 1000;

  constructor(
    private readonly erp: ErpService,
    private readonly erpSync: ErpSyncService,
    private readonly openai: OpenAiService,
    private readonly settings: SystemSettingsService,
    private readonly posImport: PosSalesImportService,
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
    @InjectRepository(BranchStorefrontActivity)
    private readonly activityRepo: Repository<BranchStorefrontActivity>,
  ) {}

  private readonly activityUploadDir = path.join(process.cwd(), 'uploads', 'revenue', 'activities');

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

  private branchRootCause(ordersGrowthPct: number, avgTicketGrowthPct: number): BranchRootCause {
    const billDown = ordersGrowthPct < -5;
    const avgDown = avgTicketGrowthPct < -5;
    const billUp = ordersGrowthPct > 5;
    if (billDown && avgDown) return 'trafficAndUpsell';
    if (billDown && !avgDown) return 'traffic';
    if (!billDown && avgDown) return billUp ? 'smallBasket' : 'upsell';
    return 'healthy';
  }

  private branchMarketingStatus(ctx: {
    revenueGrowthPct: number;
    ordersGrowthPct: number;
    avgTicketGrowthPct: number;
    targetAchievementPct: number | null;
    forecastGap: number | null;
  }): BranchMarketingStatus {
    if ((ctx.targetAchievementPct ?? 0) >= 100 || (ctx.forecastGap !== null && ctx.forecastGap <= 0)) {
      return 'aboveTarget';
    }
    if (ctx.revenueGrowthPct < -30 && (ctx.forecastGap ?? 1) > 0) return 'critical';
    if (ctx.revenueGrowthPct < -10) return 'watch';
    if (ctx.ordersGrowthPct < -10 && ctx.avgTicketGrowthPct >= -5) return 'billDrop';
    if (ctx.avgTicketGrowthPct < -10 && ctx.ordersGrowthPct >= -5) return 'avgDrop';
    return 'healthy';
  }

  private summarizeTrafficByBranch(rows: BranchTrafficDaily[], from: string, to: string) {
    const map = new Map<number, { footTraffic: number; transactions: number; conversionPct: number | null }>();
    for (const r of rows) {
      if (r.trafficDate < from || r.trafficDate > to) continue;
      const current = map.get(r.branchId) ?? { footTraffic: 0, transactions: 0, conversionPct: null };
      current.footTraffic += r.footTraffic;
      current.transactions += r.transactions ?? 0;
      map.set(r.branchId, current);
    }
    for (const row of map.values()) {
      row.conversionPct =
        row.footTraffic > 0 && row.transactions > 0
          ? Math.round((row.transactions / row.footTraffic) * 10000) / 100
          : null;
    }
    return map;
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
      monthlyTargets,
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
      this.targetRepo.find({ where: { tenantId, yearMonth: this.currentYearMonth() } }),
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
    const branchTargetMap = new Map(
      monthlyTargets
        .filter((t) => t.branchId !== null)
        .map((t) => [Number(t.branchId), num(t.targetRevenue)]),
    );
    const trafficByBranch = this.summarizeTrafficByBranch(trafficRows, mtd.from, mtd.to);

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

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const remainingDays = Math.max(1, daysInMonth - dayOfMonth);

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
      const branchTarget = branchTargetMap.get(b.id);
      const allocatedTarget =
        !branchTarget && targetRevenue && prevSummary.revenue > 0
          ? Math.round(targetRevenue * (prevRev / prevSummary.revenue))
          : null;
      const resolvedTarget = branchTarget ?? allocatedTarget;
      const targetAchievementPct =
        resolvedTarget && resolvedTarget > 0
          ? Math.round((b.revenue / resolvedTarget) * 1000) / 10
          : null;
      const forecastRevenue = Math.round((b.revenue / Math.max(1, dayOfMonth)) * daysInMonth);
      const forecastGap =
        resolvedTarget !== null && resolvedTarget !== undefined
          ? Math.round((resolvedTarget - forecastRevenue) * 100) / 100
          : null;
      const dailyGapToTarget =
        resolvedTarget !== null && resolvedTarget !== undefined
          ? Math.max(0, Math.round(((resolvedTarget - b.revenue) / remainingDays) * 100) / 100)
          : null;
      const branchTraffic = trafficByBranch.get(b.id);
      const rootCause = this.branchRootCause(ordGrowth, avgGrowth);
      const marketingStatus = this.branchMarketingStatus({
        revenueGrowthPct: revGrowth,
        ordersGrowthPct: ordGrowth,
        avgTicketGrowthPct: avgGrowth,
        targetAchievementPct,
        forecastGap,
      });
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
        targetRevenue: resolvedTarget ?? null,
        targetSource: branchTarget ? 'branch' : allocatedTarget ? 'allocated' : 'none',
        targetAchievementPct,
        forecastRevenue,
        forecastGap,
        dailyGapToTarget,
        footTraffic: branchTraffic?.footTraffic ?? null,
        conversionPct: branchTraffic?.conversionPct ?? null,
        campaignBills: 0,
        campaignConversionPct: null,
        billTierCounts: undefined,
        topNationalities: [],
        topProducts: [],
        topPromotions: [],
        marketingStatus,
        rootCause,
      };
    });

    branches.sort((a, b) => b.revenue - a.revenue);
    const worstBranch =
      [...branches].sort((a, b) => b.concernScore - a.concernScore)[0] ?? null;

    const greenCount = branches.filter((b) => b.status === 'green').length;
    const yellowCount = branches.filter((b) => b.status === 'yellow').length;
    const redCount = branches.filter((b) => b.status === 'red').length;

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
    const billNearPromo = await this.buildBillNearPromo(mtd.from, mtd.to, branches, force);
    const promoBranchMap = new Map(billNearPromo.branches.map((b) => [b.id, b]));
    let posInsightMap = new Map<string, PosBranchInsight>();
    try {
      posInsightMap = await this.posImport.branchInsights(tenantId, this.currentYearMonth());
    } catch (err) {
      this.logger.warn(`POS branch insight unavailable: ${(err as Error).message}`);
    }
    for (const branch of branches) {
      const promo = promoBranchMap.get(branch.id);
      if (promo) {
        branch.campaignBills = promo.total;
        branch.campaignConversionPct =
          branch.orders > 0 ? Math.round((promo.total / branch.orders) * 1000) / 10 : null;
      }
      const pos = posInsightMap.get(branch.shortcode || branch.code) ?? posInsightMap.get(branch.code);
      if (pos) {
        branch.campaignBills = pos.campaignBills || branch.campaignBills || 0;
        branch.campaignConversionPct = pos.campaignConversionPct ?? branch.campaignConversionPct ?? null;
        branch.billTierCounts = pos.billTierCounts;
        branch.topNationalities = pos.topNationalities.slice(0, 5);
        branch.topProducts = pos.topProducts.slice(0, 5);
        branch.topPromotions = pos.topPromotions.slice(0, 5);
      }
    }

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
      billNearPromo,
      activeBranchCodes: activeCodes,
      activeBranches,
    };
  }

  /** ยอดขายรายวันแยกสาขา — ใช้ ERP timeseries ต่อสาขา (เทียบกราฟ ERP dashboard) */
  async branchDailySales(from?: string, to?: string, force = false) {
    const activeCodes = await this.getActiveBranchCodes();
    const activeSet = new Set(activeCodes);
    const today = new Date();
    const rangeTo = to ?? fmt(today);
    const rangeFrom =
      from ??
      (() => {
        const d = new Date(today);
        d.setDate(d.getDate() - 14);
        return fmt(d);
      })();

    const erpBranches = await this.erp.branches(force);
    const activeBranches = erpBranches
      .filter((b) => branchMatchesActive(b, activeSet))
      .sort((a, b) =>
        (a.shortcode || a.code).localeCompare(b.shortcode || b.code, 'th'),
      );

    const branchSeries = await Promise.all(
      activeBranches.map(async (b) => {
        try {
          const series = await this.erp.timeseries(rangeFrom, rangeTo, 'day', b.id, force);
          return {
            id: b.id,
            code: b.code,
            shortcode: b.shortcode || b.code,
            name: b.name,
            series,
          };
        } catch (err) {
          this.logger.warn(`branch timeseries failed for ${b.shortcode || b.code}: ${err}`);
          return {
            id: b.id,
            code: b.code,
            shortcode: b.shortcode || b.code,
            name: b.name,
            series: [] as Array<{ date: string; revenue: number; orders: number }>,
          };
        }
      }),
    );

    const dateSet = new Set<string>();
    for (const br of branchSeries) {
      for (const p of br.series) dateSet.add(p.date);
    }
    const dates = [...dateSet].sort();

    const branches = branchSeries.map((b) => {
      const byDate = new Map(b.series.map((p) => [p.date, p]));
      return {
        id: b.id,
        code: b.code,
        shortcode: b.shortcode,
        name: b.name,
        points: dates.map((d) => {
          const row = byDate.get(d);
          return { date: d, revenue: row?.revenue ?? 0, orders: row?.orders ?? 0 };
        }),
        totalRevenue: b.series.reduce((s, p) => s + p.revenue, 0),
      };
    });

    // ตรวจยอดวันล่าสุดที่มีข้อมูล — เทียบ sum สาขา vs ERP by_branch วันเดียว
    let verification: {
      date: string;
      branchSum: number;
      erpByBranch: number;
      match: boolean;
    } | null = null;

    if (dates.length > 0) {
      const verifyDate = dates[dates.length - 1];
      const branchSum = branches.reduce(
        (s, b) => s + (b.points.find((p) => p.date === verifyDate)?.revenue ?? 0),
        0,
      );
      try {
        const erpDay = await this.erp.salesByBranch(verifyDate, verifyDate, force);
        const erpFiltered = erpDay.filter((b) => branchMatchesActive(b, activeSet));
        const erpByBranch = erpFiltered.reduce((s, b) => s + b.revenue, 0);
        const diff = Math.abs(branchSum - erpByBranch);
        verification = {
          date: verifyDate,
          branchSum: Math.round(branchSum * 100) / 100,
          erpByBranch: Math.round(erpByBranch * 100) / 100,
          match: diff < 1 || (erpByBranch > 0 && diff / erpByBranch < 0.01),
        };
      } catch {
        verification = null;
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      period: { from: rangeFrom, to: rangeTo },
      dates,
      branches,
      verification,
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

    const [countryProbe, receiptAllProbe, receiptCountryProbe] = await Promise.all([
      this.erp.customerCountrySales(range.from, range.to, 30, force),
      this.erp.receiptLines(range.from, range.to, { limit: 5000 }, force),
      this.erp.receiptLines(range.from, range.to, { country: selectedCountry, limit: 5000 }, force),
    ]);

    const warnings: string[] = [];
    const missingFields = new Set<string>([
      ...countryProbe.missingFields,
      ...receiptAllProbe.missingFields,
      ...receiptCountryProbe.missingFields,
    ]);
    if (countryProbe.message) warnings.push(countryProbe.message);
    if (receiptAllProbe.message && !receiptCountryProbe.supported) warnings.push(receiptAllProbe.message);
    if (receiptCountryProbe.message) warnings.push(receiptCountryProbe.message);

    const lineCountries = this.countrySummaryFromReceiptLines(receiptAllProbe.data);
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

    const lines = receiptCountryProbe.data;
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

    const reliable =
      countryProbe.supported ||
      receiptCountryProbe.supported ||
      (receiptAllProbe.supported && lineCountries.length > 0);
    if (!countryProbe.supported && !receiptCountryProbe.supported && !receiptAllProbe.supported) {
      warnings.push(
        'ต้องมี ERP endpoint สำหรับประเทศลูกค้าและรายการสินค้าในบิลเดียวกันก่อน จึงจะวิเคราะห์ได้แม่นยำ',
      );
    } else if (!receiptCountryProbe.supported) {
      warnings.push('ยังวิเคราะห์สินค้าซื้อคู่กันไม่ได้ เพราะ ERP ไม่คืนรายการสินค้าในบิลเดียวกัน');
    } else if (!countryProbe.supported && lineCountries.length > 0) {
      warnings.push('Country leaderboard คำนวณจาก receipt lines เท่านั้น เพราะ ERP ไม่มี endpoint สรุปประเทศโดยตรง');
    } else if (!countryProbe.supported) {
      warnings.push('Country leaderboard อาจไม่ครบ — ลองใช้ tourist API หรือ sync receipt lines');
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
        receiptLineSource: receiptCountryProbe.source ?? receiptAllProbe.source,
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

  async branchCountryAnalytics(
    from?: string,
    to?: string,
    branchId?: number,
    force = false,
  ): Promise<BranchCountryAnalyticsResponse> {
    const mtd = this.mtdRange();
    const range = { from: from || mtd.from, to: to || mtd.to };
    const activeCodes = await this.getActiveBranchCodes();
    const activeSet = new Set(activeCodes);
    const erpBranches = await this.erp.branches(force);
    let activeBranches = erpBranches
      .filter((b) => branchMatchesActive(b, activeSet))
      .sort((a, b) => (a.shortcode || a.code).localeCompare(b.shortcode || b.code, 'th'));

    if (branchId) {
      activeBranches = activeBranches.filter((b) => b.id === branchId);
    }

    const warnings: string[] = [];
    let source: string | null = null;
    let reliable = false;

    const branchCountryMap = new Map<
      number,
      Map<string, { country: string; revenue: number; orders: number }>
    >();

    const mergeRow = (
      bid: number,
      bcode: string,
      countryName: string,
      revenue: number,
      orders: number,
    ) => {
      let resolvedId = bid;
      if (resolvedId <= 0 && bcode) {
        const upper = bcode.trim().toUpperCase();
        const match = erpBranches.find(
          (b) => b.shortcode.toUpperCase() === upper || b.code.toUpperCase() === upper,
        );
        if (match) resolvedId = match.id;
      }
      if (resolvedId <= 0) return;
      this.mergeBranchCountryRow(branchCountryMap, resolvedId, countryName, revenue, orders);
    };

    const bulkProbe = await this.erp.touristByBranchCountry(range.from, range.to, undefined, force);
    if (bulkProbe.supported && bulkProbe.data.length > 0) {
      source = bulkProbe.source;
      reliable = true;
      for (const row of bulkProbe.data) {
        mergeRow(row.branchId, row.branchCode, row.country, row.revenue, row.orders);
      }
    } else if (bulkProbe.message) {
      warnings.push(bulkProbe.message);
    }

    if (branchCountryMap.size === 0) {
      const perBranch = await Promise.all(
        activeBranches.map(async (b) => {
          const probe = await this.erp.touristByBranchCountry(range.from, range.to, b.id, force);
          return { branch: b, probe };
        }),
      );
      const withData = perBranch.filter((r) => r.probe.supported && r.probe.data.length > 0);
      if (withData.length > 0) {
        source = withData[0].probe.source;
        reliable = true;
        for (const { branch, probe } of withData) {
          for (const row of probe.data) {
            mergeRow(branch.id, branch.shortcode || branch.code, row.country, row.revenue, row.orders);
          }
        }
      } else {
        warnings.push('ERP tourist API ไม่คืนข้อมูลรายสาขา — ลอง aggregate จาก receipt lines');
      }
    }

    if (branchCountryMap.size === 0) {
      const receiptProbe = await this.erp.receiptLines(range.from, range.to, { limit: 5000 }, force);
      if (receiptProbe.supported && receiptProbe.data.length > 0) {
        source = receiptProbe.source;
        reliable = true;
        warnings.push('ใช้ receipt lines เป็น fallback — อาจไม่ครบทุกบิล (limit 5,000)');
        for (const line of receiptProbe.data) {
          const countryName = line.customerCountry || 'ไม่ระบุประเทศ';
          mergeRow(line.branchId, line.branchCode, countryName, line.revenue, 0);
        }
      } else if (receiptProbe.message) {
        warnings.push(receiptProbe.message);
      }
    }

    const branches = activeBranches.map((b) => {
      const countryMap = branchCountryMap.get(b.id);
      const countries = countryMap
        ? [...countryMap.values()].sort((a, c) => c.revenue - a.revenue).slice(0, 3)
        : [];

      const totalRevenue = countryMap
        ? [...countryMap.values()].reduce((s, r) => s + r.revenue, 0)
        : 0;

      return {
        id: b.id,
        code: b.code,
        shortcode: b.shortcode || b.code,
        name: b.name,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        topCountries: countries.map((c, i) => ({
          rank: i + 1,
          country: c.country,
          revenue: Math.round(c.revenue * 100) / 100,
          orders: c.orders,
          revenueSharePct:
            totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 1000) / 10 : 0,
        })),
      };
    });

    if (!reliable) {
      warnings.push('ยังไม่มีข้อมูลประเทศลูกค้ารายสาขาจาก ERP — ตรวจว่า tourist API เปิดใช้งานแล้ว');
    }

    return {
      generatedAt: new Date().toISOString(),
      period: range,
      dataQuality: {
        reliable,
        source,
        warnings: [...new Set(warnings)],
      },
      branches,
    };
  }

  async branchCountryProducts(
    branchId: number,
    country: string,
    from?: string,
    to?: string,
    force = false,
  ): Promise<BranchCountryProductsResponse> {
    const mtd = this.mtdRange();
    const range = { from: from || mtd.from, to: to || mtd.to };
    const selectedCountry = country?.trim() || 'Thailand';
    const warnings: string[] = [];

    const erpBranches = await this.erp.branches(force);
    const branch = erpBranches.find((b) => b.id === branchId);
    const branchCode = branch?.shortcode || branch?.code || '';

    const categoryProbe = await this.erp.touristByCountryCategory(
      range.from,
      range.to,
      selectedCountry,
      branchId,
      force,
    );

    let products: BranchCountryProductsResponse['products'] = [];
    let source: string | null = null;
    let reliable = false;

    if (categoryProbe.supported && categoryProbe.data.length > 0) {
      source = categoryProbe.source;
      reliable = true;
      products = categoryProbe.data
        .map((r) => ({
          sku: r.sku,
          name: r.productName || r.sku,
          category: r.category,
          qty: Math.round(r.qty * 100) / 100,
          revenue: Math.round(r.revenue * 100) / 100,
          orders: r.orders,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 15);
    } else if (categoryProbe.message) {
      warnings.push(categoryProbe.message);
    }

    if (products.length === 0) {
      const receiptProbe = await this.erp.receiptLines(range.from, range.to, {
        country: selectedCountry,
        branchId,
        limit: 5000,
      }, force);

      if (receiptProbe.supported && receiptProbe.data.length > 0) {
        source = receiptProbe.source;
        reliable = true;
        warnings.push('ใช้ receipt lines เป็น fallback สำหรับสินค้ารายประเทศ/สาขา');
        products = this.topProductsFromReceiptLines(receiptProbe.data).map((p) => ({
          sku: p.sku,
          name: p.name,
          category: p.category,
          qty: p.qty,
          revenue: p.revenue,
          orders: p.receiptCount,
        }));
      } else if (receiptProbe.message) {
        warnings.push(receiptProbe.message);
      }
    }

    if (!reliable) {
      warnings.push(`ไม่พบสินค้าขายดีของ ${selectedCountry} ที่สาขา ${branchCode || branchId}`);
    }

    return {
      generatedAt: new Date().toISOString(),
      period: range,
      branchId,
      branchCode,
      country: selectedCountry,
      dataQuality: {
        reliable,
        source,
        warnings: [...new Set(warnings)],
      },
      products,
    };
  }

  private mergeBranchCountryRow(
    map: Map<number, Map<string, { country: string; revenue: number; orders: number }>>,
    branchId: number,
    country: string,
    revenue: number,
    orders: number,
  ) {
    const countryMap = map.get(branchId) ?? new Map();
    const existing = countryMap.get(country) ?? { country, revenue: 0, orders: 0 };
    existing.revenue += revenue;
    existing.orders += orders;
    countryMap.set(country, existing);
    map.set(branchId, countryMap);
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

  private async buildBillNearPromo(
    from: string,
    to: string,
    branches: BranchHealthRow[],
    force: boolean,
  ) {
    const probe = await this.erp.salesTransactions(from, to, undefined, force);
    const bucketDefs = ErpService.PROMO_BILL_BUCKETS;

    if (!probe.supported) {
      return {
        available: false,
        source: probe.source,
        message: probe.message ?? 'ต้องมีข้อมูลรายบิลจาก ERP — ยังไม่เชื่อม endpoint',
        buckets: bucketDefs.map((b) => ({ id: b.id, label: b.label, count: 0 })),
        branches: branches.map((b) => ({
          id: b.id,
          code: b.code,
          shortcode: b.shortcode,
          name: b.name,
          buckets: bucketDefs.map((bd) => ({ id: bd.id, label: bd.label, count: 0 })),
          total: 0,
        })),
        totalBills: 0,
      };
    }

    const bucketTotals = new Map<string, number>();
    const branchBucketMap = new Map<number, Map<string, number>>();

    for (const row of probe.data) {
      const bucketId = ErpService.classifyPromoBillBucket(row.amount);
      if (!bucketId) continue;
      bucketTotals.set(bucketId, (bucketTotals.get(bucketId) ?? 0) + 1);
      const bid = row.branchId;
      const bmap = branchBucketMap.get(bid) ?? new Map<string, number>();
      bmap.set(bucketId, (bmap.get(bucketId) ?? 0) + 1);
      branchBucketMap.set(bid, bmap);
    }

    const totalBills = [...bucketTotals.values()].reduce((s, n) => s + n, 0);
    const buckets = bucketDefs.map((b) => ({
      id: b.id,
      label: b.label,
      count: bucketTotals.get(b.id) ?? 0,
    }));

    const branchRows = branches.map((b) => {
      const bmap = branchBucketMap.get(b.id);
      const rowBuckets = bucketDefs.map((bd) => ({
        id: bd.id,
        label: bd.label,
        count: bmap?.get(bd.id) ?? 0,
      }));
      return {
        id: b.id,
        code: b.code,
        shortcode: b.shortcode,
        name: b.name,
        buckets: rowBuckets,
        total: rowBuckets.reduce((s, x) => s + x.count, 0),
      };
    });

    return {
      available: totalBills > 0,
      source: probe.source,
      message:
        totalBills > 0
          ? null
          : probe.message ??
            'ERP คืนข้อมูลบิลแล้ว แต่ไม่พบบิลในช่วง bucket 800–898 / 900–998 / 3,500–3,998',
      buckets,
      branches: branchRows,
      totalBills,
    };
  }

  async listStorefrontActivities(
    tenantId: number,
    from?: string,
    to?: string,
    branchId?: number,
  ) {
    const qb = this.activityRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .orderBy('a.activity_date', 'DESC')
      .addOrderBy('a.id', 'DESC');
    if (from) qb.andWhere('a.activity_date >= :from', { from });
    if (to) qb.andWhere('a.activity_date <= :to', { to });
    if (branchId) qb.andWhere('a.branch_id = :branchId', { branchId });
    return qb.take(200).getMany();
  }

  async storefrontActivitySummary(tenantId: number, from?: string, to?: string) {
    const qb = this.activityRepo
      .createQueryBuilder('a')
      .select('a.branch_id', 'branchId')
      .addSelect('a.branch_code', 'branchCode')
      .addSelect('COUNT(*)', 'activityCount')
      .addSelect('MAX(a.activity_date)', 'lastActivityDate')
      .where('a.tenant_id = :tenantId', { tenantId })
      .groupBy('a.branch_id')
      .addGroupBy('a.branch_code');
    if (from) qb.andWhere('a.activity_date >= :from', { from });
    if (to) qb.andWhere('a.activity_date <= :to', { to });
    const rows = await qb.getRawMany<{
      branchId: string;
      branchCode: string | null;
      activityCount: string;
      lastActivityDate: string;
    }>();
    return rows.map((r) => ({
      branchId: Number(r.branchId),
      branchCode: r.branchCode,
      activityCount: Number(r.activityCount),
      lastActivityDate: r.lastActivityDate,
    }));
  }

  private saveActivityPhotos(photoDataUrls: string[]): string[] {
    if (!photoDataUrls.length) return [];
    fs.mkdirSync(this.activityUploadDir, { recursive: true });
    const urls: string[] = [];
    for (const dataUrl of photoDataUrls) {
      const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) continue;
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const filename = `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const full = path.join(this.activityUploadDir, filename);
      fs.writeFileSync(full, Buffer.from(match[2], 'base64'));
      urls.push(`/uploads/revenue/activities/${filename}`);
    }
    return urls;
  }

  async createStorefrontActivity(
    tenantId: number,
    userId: number | undefined,
    dto: {
      branchId: number;
      branchCode?: string | null;
      activityDate: string;
      title: string;
      description?: string | null;
      photoUrls?: string[] | null;
      photoDataUrls?: string[] | null;
    },
  ) {
    const uploaded = dto.photoDataUrls?.length
      ? this.saveActivityPhotos(dto.photoDataUrls)
      : [];
    const photoUrls = [...(dto.photoUrls ?? []), ...uploaded];
    const row = this.activityRepo.create({
      tenantId,
      branchId: dto.branchId,
      branchCode: dto.branchCode ?? null,
      activityDate: dto.activityDate,
      title: dto.title,
      description: dto.description ?? null,
      photoUrls: photoUrls.length ? photoUrls : null,
      createdBy: userId ?? null,
    });
    return this.activityRepo.save(row);
  }

  async branchAiAnalysis(
    tenantId: number,
    branchId: number,
    force = false,
  ): Promise<BranchAiAnalysisResponse> {
    const cacheKey = `${tenantId}:${branchId}`;
    if (!force) {
      const cached = this.branchAiCache.get(cacheKey);
      if (cached && Date.now() <= cached.expiry) return cached.result;
    }

    const erpBranches = await this.erp.branches(force);
    const branch = erpBranches.find((b) => b.id === branchId);
    if (!branch) throw new NotFoundException(`Branch ${branchId} not found`);

    const today = new Date();
    const toStr = fmt(today);
    const rangeStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const fromStr = fmt(rangeStart);

    const mtd = this.mtdRange();
    const prev = this.prevMonthSamePeriod();

    const [
      monthlyTrend,
      threeMonthSummary,
      topProducts,
      mtdBranchList,
      prevBranchList,
    ] = await Promise.all([
      this.erp.timeseries(fromStr, toStr, 'month', branchId, force),
      this.erp.salesSummary(fromStr, toStr, branchId, force),
      this.erp.topProducts(fromStr, toStr, 8, branchId, force),
      this.erp.salesByBranch(mtd.from, mtd.to, force),
      this.erp.salesByBranch(prev.from, prev.to, force),
    ]);

    const mtdBranch = mtdBranchList.find((b) => b.id === branchId);
    const prevBranch = prevBranchList.find((b) => b.id === branchId);
    const mtdRevenue = mtdBranch?.revenue ?? 0;
    const mtdOrders = mtdBranch?.orders ?? 0;
    const mtdAvg = mtdBranch?.avgTicket ?? (mtdOrders > 0 ? mtdRevenue / mtdOrders : 0);
    const prevRevenue = prevBranch?.revenue ?? 0;
    const prevOrders = prevBranch?.orders ?? 0;
    const prevAvg = prevBranch?.avgTicket ?? 0;
    const momGrowth = pctChange(mtdRevenue, prevRevenue);
    const ordGrowth = pctChange(mtdOrders, prevOrders);
    const momAvgGrowth = pctChange(mtdAvg, prevAvg);
    const avgVsThreeMonth = pctChange(mtdAvg, threeMonthSummary.avgTicket);
    const status = branchStatus(momGrowth);
    const concernScore =
      Math.max(0, -(momGrowth ?? 0)) * 2 + Math.max(0, -(ordGrowth ?? 0));
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayOfMonth = today.getDate();
    const remainingDays = Math.max(1, daysInMonth - dayOfMonth);
    const yearMonth = this.currentYearMonth();
    const [branchTarget, companyTarget] = await Promise.all([
      this.targetRepo.findOne({ where: { tenantId, yearMonth, branchId } }),
      this.targetRepo.findOne({ where: { tenantId, yearMonth, branchId: IsNull() } }),
    ]);
    const targetRevenue = branchTarget
      ? num(branchTarget.targetRevenue)
      : companyTarget
        ? null
        : null;
    const targetAchievementPct =
      targetRevenue && targetRevenue > 0 ? Math.round((mtdRevenue / targetRevenue) * 1000) / 10 : null;
    const forecastRevenue = Math.round((mtdRevenue / Math.max(1, dayOfMonth)) * daysInMonth);
    const forecastGap = targetRevenue !== null ? Math.round((targetRevenue - forecastRevenue) * 100) / 100 : null;
    const dailyGapToTarget =
      targetRevenue !== null ? Math.max(0, Math.round(((targetRevenue - mtdRevenue) / remainingDays) * 100) / 100) : null;
    const marketingStatus = this.branchMarketingStatus({
      revenueGrowthPct: momGrowth,
      ordersGrowthPct: ordGrowth,
      avgTicketGrowthPct: momAvgGrowth,
      targetAchievementPct,
      forecastGap,
    });
    const rootCause = this.branchRootCause(ordGrowth, momAvgGrowth);
    let posInsight: PosBranchInsight | undefined;
    try {
      const posMap = await this.posImport.branchInsights(tenantId, yearMonth);
      posInsight = posMap.get(branch.shortcode || branch.code) ?? posMap.get(branch.code);
    } catch (err) {
      this.logger.warn(`POS branch AI context unavailable: ${(err as Error).message}`);
    }

    const monthlyPoints = monthlyTrend.map((p) => ({
      month: p.date,
      revenue: Math.round(p.revenue),
      orders: p.orders,
    }));
    const monthOverMonthChanges = monthlyPoints.map((p, i) => {
      if (i === 0) return null;
      const prevRev = monthlyPoints[i - 1]!.revenue;
      return prevRev > 0 ? pctChangeOrNull(p.revenue, prevRev) : null;
    });

    const facts = {
      branch: {
        id: branch.id,
        code: branch.code,
        shortcode: branch.shortcode || branch.code,
        name: branch.name,
      },
      period: { from: fromStr, to: toStr },
      mtd: {
        revenue: Math.round(mtdRevenue),
        orders: mtdOrders,
        avgTicket: Math.round(mtdAvg),
        momRevenueGrowthPct: momGrowth,
        momOrdersGrowthPct: ordGrowth,
        momAvgTicketGrowthPct: momAvgGrowth,
        avgTicketVsThreeMonthPct: avgVsThreeMonth,
        status,
        concernScore,
      },
      prevPeriod: {
        revenue: Math.round(prevRevenue),
        orders: prevOrders,
        avgTicket: Math.round(prevAvg),
      },
      threeMonth: {
        revenue: Math.round(threeMonthSummary.revenue),
        orders: threeMonthSummary.orders,
        avgTicket: Math.round(threeMonthSummary.avgTicket),
      },
      monthlyTrend: monthlyPoints,
      monthOverMonthChanges,
      marketing: {
        targetRevenue,
        targetAchievementPct,
        forecastRevenue,
        forecastGap,
        dailyGapToTarget,
        marketingStatus,
        rootCause,
        campaignBills: posInsight?.campaignBills ?? 0,
        campaignConversionPct: posInsight?.campaignConversionPct ?? null,
        billTierCounts: posInsight?.billTierCounts ?? { gte899: 0, gte999: 0, gte1199: 0, gte3999: 0 },
        topNationalities: posInsight?.topNationalities.slice(0, 5) ?? [],
        topPromotions: posInsight?.topPromotions.slice(0, 5) ?? [],
      },
      topProducts: topProducts.slice(0, 6).map((p) => ({
        sku: p.sku,
        name: p.name,
        category: p.category,
        revenue: Math.round(p.revenue),
        qtySold: p.qtySold,
      })),
    };

    const ai = await this.buildBranchAiAnalysis(facts);

    const result: BranchAiAnalysisResponse = {
      generatedAt: new Date().toISOString(),
      branch: {
        id: branch.id,
        code: branch.code,
        shortcode: branch.shortcode || branch.code,
        name: branch.name,
      },
      period: { from: fromStr, to: toStr },
      metrics: {
        mtd: {
          revenue: Math.round(mtdRevenue),
          orders: mtdOrders,
          avgTicket: Math.round(mtdAvg),
        },
        threeMonth: {
          revenue: Math.round(threeMonthSummary.revenue),
          orders: threeMonthSummary.orders,
          avgTicket: Math.round(threeMonthSummary.avgTicket),
        },
        momRevenueGrowthPct: momGrowth,
        status,
        concernScore,
      },
      marketing: facts.marketing,
      monthlyTrend: facts.monthlyTrend,
      topProducts: facts.topProducts,
      ai,
    };

    this.branchAiCache.set(cacheKey, {
      result,
      expiry: Date.now() + this.BRANCH_AI_TTL_MS,
    });
    return result;
  }

  private async buildBranchAiAnalysis(facts: {
    branch: { shortcode: string; name: string };
    mtd: {
      revenue: number;
      orders: number;
      avgTicket: number;
      momRevenueGrowthPct: number;
      momOrdersGrowthPct: number;
      momAvgTicketGrowthPct: number;
      avgTicketVsThreeMonthPct: number;
      status: BranchHealthStatus;
    };
    prevPeriod: { revenue: number; orders: number; avgTicket: number };
    threeMonth: { revenue: number; orders: number; avgTicket: number };
    monthlyTrend: Array<{ month: string; revenue: number; orders: number }>;
    monthOverMonthChanges: Array<number | null>;
    marketing: BranchAiAnalysisResponse['marketing'];
    topProducts: Array<{ name: string; sku: string; category: string; revenue: number; qtySold: number }>;
  }): Promise<BranchAiAnalysisResponse['ai']> {
    const emptyAi = (): BranchAiAnalysisResponse['ai'] => ({
      available: false,
      source: 'none',
      summary: 'ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์',
      rootCauses: [],
      recommendedActions: [],
      promotionIdeas: [],
      stockClearIdeas: [],
      risks: [],
      next7DayChecklist: [],
    });

    if (facts.mtd.revenue <= 0 && facts.threeMonth.revenue <= 0) {
      return emptyAi();
    }

    const systemPrompt =
      'You are a retail revenue analyst for 100 Baht Shop branches in Thailand. ' +
      'Analyze ONLY the provided facts (3-month branch sales). Reply in Thai with valid JSON only, no markdown. ' +
      'Schema: {"summary":"string","rootCauses":["string"],"recommendedActions":["string"],' +
      '"promotionIdeas":["string"],"stockClearIdeas":["string"],"risks":["string"],"next7DayChecklist":["string"]}. ' +
      'Use monthOverMonthChanges and momAvgTicketGrowthPct to explain whether the drop is traffic (orders) or basket size (avg ticket). ' +
      'Use marketing.targetRevenue, forecastRevenue, dailyGapToTarget, rootCause, billTierCounts, topNationalities, and topPromotions when present. ' +
      'Reference topProducts by name when suggesting promos or clearance. ' +
      'Focus on practical fixes: promotions, clearance/stock rotation, front-store display, traffic conversion, avg bill uplift. ' +
      'Each array should have 3-5 concise actionable items in Thai.';

    if (this.openai.isConfigured()) {
      try {
        const result = await this.openai.complete(systemPrompt, JSON.stringify(facts));
        const parsed = this.parseBranchAiJson(result.content);
        if (parsed) {
          return { available: true, source: 'openai', ...parsed };
        }
      } catch (err) {
        this.logger.warn(`Branch AI analysis failed: ${(err as Error).message}`);
      }
    }

    return this.heuristicBranchAi(facts);
  }

  private parseBranchAiJson(content: string): Omit<BranchAiAnalysisResponse['ai'], 'available' | 'source'> | null {
    if (!content?.trim()) return null;
    try {
      const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const obj = JSON.parse(cleaned) as Record<string, unknown>;
      const asStrings = (v: unknown): string[] =>
        Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
      return {
        summary: String(obj.summary ?? '').trim() || 'สรุปจากข้อมูลยอดขาย 3 เดือน',
        rootCauses: asStrings(obj.rootCauses),
        recommendedActions: asStrings(obj.recommendedActions),
        promotionIdeas: asStrings(obj.promotionIdeas),
        stockClearIdeas: asStrings(obj.stockClearIdeas),
        risks: asStrings(obj.risks),
        next7DayChecklist: asStrings(obj.next7DayChecklist),
      };
    } catch {
      return null;
    }
  }

  private heuristicBranchAi(facts: {
    branch: { shortcode: string; name: string };
    mtd: {
      revenue: number;
      orders: number;
      avgTicket: number;
      momRevenueGrowthPct: number;
      momOrdersGrowthPct: number;
      momAvgTicketGrowthPct: number;
      avgTicketVsThreeMonthPct: number;
      status: BranchHealthStatus;
    };
    threeMonth: { revenue: number; avgTicket: number };
    monthlyTrend: Array<{ month: string; revenue: number }>;
    monthOverMonthChanges: Array<number | null>;
    marketing: BranchAiAnalysisResponse['marketing'];
    topProducts: Array<{ name: string; category: string; revenue: number }>;
  }): BranchAiAnalysisResponse['ai'] {
    const { mtd, branch, topProducts } = facts;
    const rootCauses: string[] = [];
    const recommendedActions: string[] = [];
    const promotionIdeas: string[] = [];
    const stockClearIdeas: string[] = [];
    const risks: string[] = [];
    const next7DayChecklist: string[] = [];

    if (mtd.momRevenueGrowthPct < -5) {
      rootCauses.push(`ยอด MTD ลด ${Math.abs(mtd.momRevenueGrowthPct).toFixed(1)}% เทียบเดือนก่อน`);
      recommendedActions.push('จัดโปรโมชันหน้าร้าน 3-7 วันเพื่อดึง traffic และบิล');
      promotionIdeas.push('Bundle 2 ชิ้น ราคาพิเศษใกล้ avg bill ปัจจุบัน');
      risks.push('ยอดตกต่อเนื่องถ้าไม่มี action ภายใน 7 วัน');
    } else if (mtd.status === 'yellow') {
      rootCauses.push('ยอดทรงตัว ไม่โตตามเป้า');
      recommendedActions.push('ทดลอง cross-sell สินค้าขายดีคู่กับสินค้า margin สูง');
    } else {
      rootCauses.push('ยอดยังอยู่ในเกณฑ์ดี — โฟกัสรักษา momentum');
      recommendedActions.push('ขยาย front-store ด้วยสินค้าขายดี 3 อันดับแรก');
    }

    if (facts.marketing.dailyGapToTarget && facts.marketing.dailyGapToTarget > 0) {
      recommendedActions.push(`ตั้ง daily mission เพิ่มยอดอย่างน้อย ฿${Math.round(facts.marketing.dailyGapToTarget).toLocaleString('th-TH')}/วัน`);
      risks.push('Forecast ยังไม่ถึงเป้าเดือนนี้ถ้า run rate ไม่ดีขึ้น');
    }

    if (facts.marketing.campaignBills > 0) {
      promotionIdeas.push(`ต่อยอดแคมเปญที่มี traction แล้ว (${facts.marketing.campaignBills.toLocaleString('th-TH')} บิลเข้าแคมเปญ)`);
    }

    const topNat = facts.marketing.topNationalities[0];
    if (topNat) {
      recommendedActions.push(`ปรับป้าย/สคริปต์ให้ตรงกลุ่ม ${topNat.nationality} ซึ่งเป็นลูกค้าหลักของสาขา`);
    }

    if (mtd.momOrdersGrowthPct < mtd.momRevenueGrowthPct - 3) {
      rootCauses.push('จำนวนบิลลดมากกว่ายอดขาย — อาจมีปัญหา traffic/conversion');
      recommendedActions.push('เพิ่มป้ายโปรหน้าร้านและตรวจ conversion รายวัน');
      next7DayChecklist.push('บันทึก foot traffic และบิลรายวัน 7 วัน');
    }

    if (mtd.momAvgTicketGrowthPct < -3) {
      rootCauses.push(`ค่าเฉลี่ย/บิลลด ${Math.abs(mtd.momAvgTicketGrowthPct).toFixed(1)}% — ลูกค้าซื้อน้อยลงต่อบิล`);
      promotionIdeas.push('โปร "ซื้อเพิ่ม X บาท ลด Y%" หรือ bundle 2 ชิ้น');
    }

    const lastMonthChange = facts.monthOverMonthChanges[facts.monthOverMonthChanges.length - 1];
    if (lastMonthChange !== null && lastMonthChange < -10) {
      rootCauses.push(`เดือนล่าสุดลด ${Math.abs(lastMonthChange).toFixed(1)}% จากเดือนก่อน`);
      risks.push('แนวโน้มรายเดือนยังลง — ต้อง action ภายใน 7 วัน');
    }

    if (mtd.avgTicketVsThreeMonthPct < -5) {
      rootCauses.push('ค่าเฉลี่ย/บิลต่ำกว่าค่าเฉลี่ย 3 เดือน');
      promotionIdeas.push('โปร "ซื้อเพิ่ม X บาท ลด Y%" เพื่อดัน avg bill');
    }

    const top = topProducts[0];
    if (top) {
      recommendedActions.push(`จัดหน้าร้านเน้น ${top.name} (${top.category})`);
      stockClearIdeas.push(`ระบายสินค้าหมวดอื่นที่ขายช้า โดย bundle กับ ${top.name}`);
    } else {
      stockClearIdeas.push('ตรวจ slow-moving SKU และจัดโปร clearance สัปดาห์นี้');
    }

    if (facts.monthlyTrend.length >= 2) {
      const last = facts.monthlyTrend[facts.monthlyTrend.length - 1]?.revenue ?? 0;
      const prev = facts.monthlyTrend[facts.monthlyTrend.length - 2]?.revenue ?? 0;
      if (prev > 0 && last < prev * 0.9) {
        risks.push('แนวโน้มรายเดือนลดลง — ต้องเร่ง action ทันที');
      }
    }

    next7DayChecklist.push(
      `สรุปยอด ${branch.shortcode} ทุกเช้าและเทียบ MoM`,
      'ถ่ายรูปหน้าร้านหลังจัดโปร/สินค้า',
      'รายงานผลโปรที่รันกลับทีมการตลาด',
    );

    const summary =
      mtd.status === 'red'
        ? `สาขา ${branch.shortcode} ยอดตก MoM ${mtd.momRevenueGrowthPct.toFixed(1)}% — ควรเร่งโปรและระบายสินค้าภายใน 7 วัน`
        : mtd.status === 'yellow'
          ? `สาขา ${branch.shortcode} ยอดทรงตัว — โอกาสดันด้วยโปรและ avg bill`
          : `สาขา ${branch.shortcode} ยังแข็งแรง — รักษา momentum และขยายสินค้าขายดี`;

    return {
      available: true,
      source: 'heuristic',
      summary,
      rootCauses: rootCauses.slice(0, 4),
      recommendedActions: recommendedActions.slice(0, 4),
      promotionIdeas: promotionIdeas.slice(0, 4),
      stockClearIdeas: stockClearIdeas.slice(0, 4),
      risks: risks.slice(0, 3),
      next7DayChecklist: next7DayChecklist.slice(0, 5),
    };
  }
}
