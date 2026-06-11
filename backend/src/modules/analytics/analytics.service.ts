import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiUsage,
  Branch,
  Campaign,
  Category,
  ChatMessage,
  ChatThread,
  Product,
  SalesRecord,
} from '../../database/entities';
import { RecordSaleDto } from './dto/record-sale.dto';

export interface AnalyticsSummary {
  totalSales: number;
  totalOrders: number;
  totalQuantity: number;
  avgOrderValue: number;
  aiTokens: number;
  activeCampaigns: number;
  totalProducts: number;
  periodDays: number;
}

export interface SalesPoint {
  date: string;
  total: number;
  orders: number;
}

export interface TopProduct {
  productId: number;
  name: string;
  total: number;
  quantity: number;
}

export interface CampaignStatusCount {
  status: string;
  count: number;
}

export interface BranchSalesPoint {
  branchId: number | null;
  name: string;
  total: number;
  orders: number;
}

export interface CategorySalesPoint {
  categoryId: number | null;
  name: string;
  total: number;
  quantity: number;
}

export interface ExecutiveSummary {
  current: { totalSales: number; totalOrders: number; aiTokens: number };
  previous: { totalSales: number; totalOrders: number };
  growth: { sales: number; orders: number };
  branchCount: number;
  topBranch: BranchSalesPoint | null;
  insights: string[];
  periodDays: number;
  kpis: {
    chatThreads: number;
    chatMessages: number;
    reviews: { count: number; avgRating: number | null; placeholder: boolean };
    social: { mentions: number; placeholder: boolean };
  };
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(SalesRecord) private readonly salesRepo: Repository<SalesRecord>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(AiUsage) private readonly usageRepo: Repository<AiUsage>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    @InjectRepository(ChatThread) private readonly chatThreadRepo: Repository<ChatThread>,
    @InjectRepository(ChatMessage) private readonly chatMessageRepo: Repository<ChatMessage>,
  ) {}

  async summary(tenantId: number, days = 30, branchId?: number): Promise<AnalyticsSummary> {
    const cutoff = this.cutoff(days);

    const qb = this.salesRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(s.quantity), 0)', 'qty')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff });
    this.applyBranch(qb, branchId);
    const agg = await qb.getRawOne<{ total: string; orders: string; qty: string }>();

    const totalSales = Number(agg?.total ?? 0);
    const totalOrders = Number(agg?.orders ?? 0);
    const totalQuantity = Number(agg?.qty ?? 0);

    const usage = await this.usageRepo.findOne({
      where: { tenantId, periodMonth: this.currentPeriod() },
    });

    const activeCampaigns = await this.campaignRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.status IN (:...statuses)', { statuses: ['running', 'scheduled'] })
      .getCount();

    const totalProducts = await this.productRepo.count({
      where: { tenantId, status: 'active' },
    });

    return {
      totalSales,
      totalOrders,
      totalQuantity,
      avgOrderValue: totalOrders ? Math.round((totalSales / totalOrders) * 100) / 100 : 0,
      aiTokens: Number(usage?.totalTokens ?? 0),
      activeCampaigns,
      totalProducts,
      periodDays: days,
    };
  }

  async salesSeries(tenantId: number, days = 30, branchId?: number): Promise<SalesPoint[]> {
    const cutoff = this.cutoff(days);

    const qb = this.salesRepo
      .createQueryBuilder('s')
      .select('DATE(s.sold_at)', 'date')
      .addSelect('COALESCE(SUM(s.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'orders')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff });
    this.applyBranch(qb, branchId);
    const rows = await qb
      .groupBy('DATE(s.sold_at)')
      .orderBy('DATE(s.sold_at)', 'ASC')
      .getRawMany<{ date: string; total: string; orders: string }>();

    const map = new Map<string, { total: number; orders: number }>();
    for (const r of rows) {
      const key = this.toDateKey(r.date);
      map.set(key, { total: Number(r.total), orders: Number(r.orders) });
    }

    // เติมวันที่ขาดให้เป็น 0 เพื่อให้กราฟต่อเนื่อง
    const series: SalesPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = this.toDateKey(d);
      const hit = map.get(key);
      series.push({ date: key, total: hit?.total ?? 0, orders: hit?.orders ?? 0 });
    }
    return series;
  }

  async topProducts(tenantId: number, days = 30, limit = 5, branchId?: number): Promise<TopProduct[]> {
    const cutoff = this.cutoff(days);

    const qb = this.salesRepo
      .createQueryBuilder('s')
      .leftJoin(Product, 'p', 'p.id = s.product_id')
      .select('s.product_id', 'productId')
      .addSelect('COALESCE(p.name, :unknown)', 'name')
      .addSelect('COALESCE(SUM(s.amount), 0)', 'total')
      .addSelect('COALESCE(SUM(s.quantity), 0)', 'quantity')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff })
      .andWhere('s.product_id IS NOT NULL')
      .setParameter('unknown', 'ไม่ระบุสินค้า');
    this.applyBranch(qb, branchId);
    const rows = await qb
      .groupBy('s.product_id')
      .addGroupBy('p.name')
      .orderBy('total', 'DESC')
      .limit(limit)
      .getRawMany<{ productId: string; name: string; total: string; quantity: string }>();

    return rows.map((r) => ({
      productId: Number(r.productId),
      name: r.name,
      total: Number(r.total),
      quantity: Number(r.quantity),
    }));
  }

  async campaignStatus(tenantId: number): Promise<CampaignStatusCount[]> {
    const rows = await this.campaignRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('c.tenant_id = :tenantId', { tenantId })
      .groupBy('c.status')
      .getRawMany<{ status: string; count: string }>();

    return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  }

  listSales(tenantId: number, days = 30, branchId?: number) {
    const cutoff = this.cutoff(days);
    const qb = this.salesRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff });
    this.applyBranch(qb, branchId);
    return qb.orderBy('s.sold_at', 'DESC').limit(1000).getMany();
  }

  recordSale(tenantId: number, dto: RecordSaleDto) {
    return this.salesRepo.save(
      this.salesRepo.create({
        tenantId,
        branchId: dto.branchId ?? null,
        productId: dto.productId ?? null,
        campaignId: dto.campaignId ?? null,
        amount: dto.amount,
        quantity: dto.quantity ?? 1,
        soldAt: dto.soldAt ? new Date(dto.soldAt) : new Date(),
      }),
    );
  }

  // ---------- executive dashboard (v2) ----------

  async salesByBranch(tenantId: number, days = 30): Promise<BranchSalesPoint[]> {
    const cutoff = this.cutoff(days);
    const rows = await this.salesRepo
      .createQueryBuilder('s')
      .leftJoin(Branch, 'b', 'b.id = s.branch_id')
      .select('s.branch_id', 'branchId')
      .addSelect('COALESCE(b.name, :unknown)', 'name')
      .addSelect('COALESCE(SUM(s.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'orders')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff })
      .setParameter('unknown', 'ไม่ระบุสาขา')
      .groupBy('s.branch_id')
      .addGroupBy('b.name')
      .orderBy('total', 'DESC')
      .getRawMany<{ branchId: string | null; name: string; total: string; orders: string }>();

    return rows.map((r) => ({
      branchId: r.branchId === null ? null : Number(r.branchId),
      name: r.name,
      total: Number(r.total),
      orders: Number(r.orders),
    }));
  }

  async salesByCategory(tenantId: number, days = 30): Promise<CategorySalesPoint[]> {
    const cutoff = this.cutoff(days);
    const rows = await this.salesRepo
      .createQueryBuilder('s')
      .leftJoin(Product, 'p', 'p.id = s.product_id')
      .leftJoin(Category, 'c', 'c.id = p.category_id')
      .select('p.category_id', 'categoryId')
      .addSelect('COALESCE(c.name, :unknown)', 'name')
      .addSelect('COALESCE(SUM(s.amount), 0)', 'total')
      .addSelect('COALESCE(SUM(s.quantity), 0)', 'quantity')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff })
      .setParameter('unknown', 'ไม่ระบุหมวด')
      .groupBy('p.category_id')
      .addGroupBy('c.name')
      .orderBy('total', 'DESC')
      .getRawMany<{ categoryId: string | null; name: string; total: string; quantity: string }>();

    return rows.map((r) => ({
      categoryId: r.categoryId === null ? null : Number(r.categoryId),
      name: r.name,
      total: Number(r.total),
      quantity: Number(r.quantity),
    }));
  }

  async executiveSummary(tenantId: number, days = 30): Promise<ExecutiveSummary> {
    const cutoff = this.cutoff(days);
    const prevCutoff = this.cutoff(days * 2);

    const currentAgg = await this.salesRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'orders')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff })
      .getRawOne<{ total: string; orders: string }>();

    const prevAgg = await this.salesRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'orders')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :prevCutoff', { prevCutoff })
      .andWhere('s.sold_at < :cutoff', { cutoff })
      .getRawOne<{ total: string; orders: string }>();

    const curSales = Number(currentAgg?.total ?? 0);
    const curOrders = Number(currentAgg?.orders ?? 0);
    const prevSales = Number(prevAgg?.total ?? 0);
    const prevOrders = Number(prevAgg?.orders ?? 0);

    const usage = await this.usageRepo.findOne({
      where: { tenantId, periodMonth: this.currentPeriod() },
    });

    const branches = await this.salesByBranch(tenantId, days);
    const branchCount = await this.branchRepo.count({ where: { tenantId } });
    const topBranch = branches.find((b) => b.branchId !== null) ?? null;

    const growthSales = this.growthPct(curSales, prevSales);
    const growthOrders = this.growthPct(curOrders, prevOrders);

    const chatThreads = await this.chatThreadRepo.count({ where: { tenantId } });
    const chatMessages = await this.chatMessageRepo
      .createQueryBuilder('m')
      .innerJoin(ChatThread, 't', 't.id = m.thread_id')
      .where('t.tenant_id = :tenantId', { tenantId })
      .getCount();

    return {
      current: { totalSales: curSales, totalOrders: curOrders, aiTokens: Number(usage?.totalTokens ?? 0) },
      previous: { totalSales: prevSales, totalOrders: prevOrders },
      growth: { sales: growthSales, orders: growthOrders },
      branchCount,
      topBranch,
      insights: this.buildInsights({
        days,
        curSales,
        prevSales,
        growthSales,
        growthOrders,
        topBranch,
        branchCount,
        chatThreads,
      }),
      periodDays: days,
      kpis: {
        chatThreads,
        chatMessages,
        reviews: { count: 0, avgRating: null, placeholder: true },
        social: { mentions: 0, placeholder: true },
      },
    };
  }

  /**
   * สร้างข้อมูลตัวอย่าง (สำหรับเดโม) — สุ่มยอดขายย้อนหลัง 30 วัน
   * ทำงานเฉพาะเมื่อยังไม่มีข้อมูลยอดขาย เพื่อกันสร้างซ้ำ
   */
  async generateSample(tenantId: number): Promise<{ created: number }> {
    const existing = await this.salesRepo.count({ where: { tenantId } });
    if (existing > 0) return { created: 0 };

    const products = await this.productRepo.find({
      where: { tenantId, status: 'active' },
      take: 20,
    });

    const records: SalesRecord[] = [];
    for (let i = 0; i < 30; i++) {
      const ordersToday = Math.floor(Math.random() * 5); // 0-4 ออเดอร์/วัน
      for (let j = 0; j < ordersToday; j++) {
        const product = products.length
          ? products[Math.floor(Math.random() * products.length)]
          : null;
        const quantity = 1 + Math.floor(Math.random() * 5);
        const unit = product?.price && product.price > 0 ? product.price : 50 + Math.floor(Math.random() * 200);
        const soldAt = new Date();
        soldAt.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
        soldAt.setDate(soldAt.getDate() - i);
        records.push(
          this.salesRepo.create({
            tenantId,
            productId: product?.id ?? null,
            campaignId: null,
            amount: Math.round(unit * quantity * 100) / 100,
            quantity,
            soldAt,
          }),
        );
      }
    }

    if (records.length === 0) return { created: 0 };
    await this.salesRepo.save(records);
    return { created: records.length };
  }

  // ---------- helpers ----------

  private applyBranch(qb: { andWhere: (s: string, p?: object) => unknown }, branchId?: number): void {
    if (branchId !== undefined && branchId !== null && !Number.isNaN(branchId)) {
      qb.andWhere('s.branch_id = :branchId', { branchId });
    }
  }

  private growthPct(current: number, previous: number): number {
    if (previous <= 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private buildInsights(d: {
    days: number;
    curSales: number;
    prevSales: number;
    growthSales: number;
    growthOrders: number;
    topBranch: BranchSalesPoint | null;
    branchCount: number;
    chatThreads: number;
  }): string[] {
    const insights: string[] = [];

    if (d.curSales === 0) {
      insights.push(`ยังไม่มียอดขายในช่วง ${d.days} วันล่าสุด — ลองบันทึกยอดขายหรือสร้างข้อมูลตัวอย่างเพื่อเริ่มวิเคราะห์`);
      return insights;
    }

    if (d.growthSales > 0) {
      insights.push(`ยอดขายเติบโต ${d.growthSales}% เทียบกับช่วง ${d.days} วันก่อนหน้า — โมเมนตัมเป็นบวก ควรเพิ่มงบแคมเปญที่กำลังทำได้ดี`);
    } else if (d.growthSales < 0) {
      insights.push(`ยอดขายลดลง ${Math.abs(d.growthSales)}% เทียบกับช่วงก่อนหน้า — แนะนำตรวจสอบสินค้าขายดีและจัดโปรกระตุ้นยอด`);
    } else {
      insights.push('ยอดขายทรงตัวเทียบกับช่วงก่อนหน้า — ลองทดสอบโปรโมชันใหม่เพื่อสร้างการเติบโต');
    }

    if (d.topBranch) {
      insights.push(`สาขาที่ทำยอดสูงสุดคือ "${d.topBranch.name}" (฿${Math.round(d.topBranch.total).toLocaleString('th-TH')}) — ถอดบทเรียนความสำเร็จไปปรับใช้กับสาขาอื่น`);
    } else if (d.branchCount === 0) {
      insights.push('ยังไม่ได้ตั้งค่าสาขา — เพิ่มสาขาเพื่อดูยอดขายแยกตามสาขาและเปรียบเทียบประสิทธิภาพ');
    }

    if (d.growthOrders < 0 && d.growthSales >= 0) {
      insights.push('จำนวนออเดอร์ลดลงแต่ยอดขายไม่ลด — มูลค่าต่อออเดอร์สูงขึ้น ลองดันสินค้า/บันเดิลราคาสูงต่อ');
    }

    if (d.chatThreads > 0) {
      insights.push(`มีการใช้ผู้ช่วย AI ${d.chatThreads} ห้องสนทนา — ใช้ข้อมูลจาก chat ช่วยวางแผน content/campaign ได้`);
    }

    insights.push('Google Review และ Social Listening จะพร้อมใน Phase 9–10');

    return insights;
  }

  private cutoff(days: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return d;
  }

  private currentPeriod(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private toDateKey(value: string | Date): string {
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // ค่า DATE จาก MySQL อาจมาเป็น 'YYYY-MM-DD' หรือ ISO datetime
    return String(value).slice(0, 10);
  }
}
