import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpSalesDaily } from '../../database/entities';
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
    @InjectRepository(ErpSalesDaily) private readonly repo: Repository<ErpSalesDaily>,
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
      this.repo.create({
        saleDate: p.date,
        orders: Math.round(p.orders),
        revenue: p.revenue.toFixed(2),
      }),
    );
    // upsert ตาม primary key (sale_date) — เขียนทับยอดล่าสุดเสมอ
    await this.repo.upsert(rows, ['saleDate']);
    this.logger.log(`Synced ${rows.length} ERP daily rows (${fromStr} → ${toStr})`);
    return { synced: rows.length, from: fromStr, to: toStr };
  }

  /** อ่านประวัติยอดขายรายวันที่เก็บไว้ (ใหม่ → เก่า แล้วกลับลำดับให้เก่า → ใหม่) */
  async history(days = 90): Promise<ErpDailyPoint[]> {
    const rows = await this.repo.find({
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
}
