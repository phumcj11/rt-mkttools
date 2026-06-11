import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiUsage,
  Campaign,
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

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(SalesRecord) private readonly salesRepo: Repository<SalesRecord>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(AiUsage) private readonly usageRepo: Repository<AiUsage>,
  ) {}

  async summary(tenantId: number, days = 30): Promise<AnalyticsSummary> {
    const cutoff = this.cutoff(days);

    const agg = await this.salesRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(s.quantity), 0)', 'qty')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff })
      .getRawOne<{ total: string; orders: string; qty: string }>();

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

  async salesSeries(tenantId: number, days = 30): Promise<SalesPoint[]> {
    const cutoff = this.cutoff(days);

    const rows = await this.salesRepo
      .createQueryBuilder('s')
      .select('DATE(s.sold_at)', 'date')
      .addSelect('COALESCE(SUM(s.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'orders')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff })
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

  async topProducts(tenantId: number, days = 30, limit = 5): Promise<TopProduct[]> {
    const cutoff = this.cutoff(days);

    const rows = await this.salesRepo
      .createQueryBuilder('s')
      .leftJoin(Product, 'p', 'p.id = s.product_id')
      .select('s.product_id', 'productId')
      .addSelect('COALESCE(p.name, :unknown)', 'name')
      .addSelect('COALESCE(SUM(s.amount), 0)', 'total')
      .addSelect('COALESCE(SUM(s.quantity), 0)', 'quantity')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff })
      .andWhere('s.product_id IS NOT NULL')
      .setParameter('unknown', 'ไม่ระบุสินค้า')
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

  listSales(tenantId: number, days = 30) {
    const cutoff = this.cutoff(days);
    return this.salesRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.sold_at >= :cutoff', { cutoff })
      .orderBy('s.sold_at', 'DESC')
      .limit(1000)
      .getMany();
  }

  recordSale(tenantId: number, dto: RecordSaleDto) {
    return this.salesRepo.save(
      this.salesRepo.create({
        tenantId,
        productId: dto.productId ?? null,
        campaignId: dto.campaignId ?? null,
        amount: dto.amount,
        quantity: dto.quantity ?? 1,
        soldAt: dto.soldAt ? new Date(dto.soldAt) : new Date(),
      }),
    );
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
