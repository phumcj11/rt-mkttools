import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { PosImportRun, PosSalesLine } from '../../database/entities';
import { DriveService } from '../media/drive.service';

const POS_FOLDER_KEY = 'google_pos_sales_folder_id';
const XLSX_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

type RawRow = Record<string, unknown>;

export interface PosBranchInsight {
  branchCode: string;
  revenue: number;
  orders: number;
  avgBill: number;
  campaignBills: number;
  campaignConversionPct: number | null;
  billTierCounts: Record<string, number>;
  topNationalities: Array<{ nationality: string; receipts: number; revenue: number }>;
  topProducts: Array<{ sku: string; name: string; qty: number; revenue: number }>;
  topPromotions: Array<{ promotionName: string; receipts: number; revenue: number }>;
}

const str = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};

const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '0').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const isoDate = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
};

const isoDateTime = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) return s.replace(' ', 'T').slice(0, 19).replace('T', ' ');
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 19).replace('T', ' ');
  return null;
};

const classifyTier = (receiptTotal: number): string | null => {
  if (receiptTotal >= 3999) return 'gte3999';
  if (receiptTotal >= 1199) return 'gte1199';
  if (receiptTotal >= 999) return 'gte999';
  if (receiptTotal >= 899) return 'gte899';
  return null;
};

@Injectable()
export class PosSalesImportService {
  private readonly logger = new Logger(PosSalesImportService.name);

  constructor(
    @InjectRepository(PosImportRun)
    private readonly runRepo: Repository<PosImportRun>,
    @InjectRepository(PosSalesLine)
    private readonly lineRepo: Repository<PosSalesLine>,
    private readonly drive: DriveService,
  ) {}

  listRuns(tenantId: number, yearMonth?: string) {
    return this.runRepo.find({
      where: yearMonth ? { tenantId, yearMonth } : { tenantId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async syncFromDrive(tenantId: number, yearMonth: string, force = false) {
    const file = await this.findDriveFile(yearMonth);
    const buffer = await this.drive.downloadFile(file.id, POS_FOLDER_KEY);
    return this.importBuffer(tenantId, yearMonth, file.name, buffer, {
      force,
      driveFileId: file.id,
    });
  }

  async importLocalFile(tenantId: number, yearMonth: string, localPath: string, force = false) {
    const buffer = fs.readFileSync(localPath);
    const filename = localPath.split(/[\\/]/).pop() ?? localPath;
    return this.importBuffer(tenantId, yearMonth, filename, buffer, { force, driveFileId: null });
  }

  private async findDriveFile(yearMonth: string) {
    const [yyyy, mm] = yearMonth.split('-');
    const candidates = [`${mm}-${yyyy}`, `${yearMonth}`, `${mm}_${yyyy}`].filter(Boolean);
    let lastErr: unknown = null;
    for (const nameContains of candidates) {
      try {
        const files = await this.drive.listFiles({
          folderKey: POS_FOLDER_KEY,
          nameContains,
          mimeTypes: XLSX_MIMES,
          pageSize: 20,
        });
        const found = files.find((f) => /\.(xlsx|xls)$/i.test(f.name)) ?? files[0];
        if (found) return found;
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(`POS_DRIVE_FILE_NOT_FOUND:${yearMonth}:${(lastErr as Error | null)?.message ?? ''}`);
  }

  private async importBuffer(
    tenantId: number,
    yearMonth: string,
    filename: string,
    buffer: Buffer,
    opts: { force: boolean; driveFileId: string | null },
  ) {
    const existing = await this.runRepo.findOne({
      where: {
        tenantId,
        yearMonth,
        driveFileId: opts.driveFileId ?? IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
    if (existing?.status === 'completed' && !opts.force) return existing;

    const run = await this.runRepo.save(this.runRepo.create({
      tenantId,
      yearMonth,
      driveFileId: opts.driveFileId,
      filename,
      status: 'running',
    }));

    try {
      if (opts.force) {
        await this.lineRepo.delete({ tenantId, yearMonth });
      }

      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('Excel has no sheets');
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: false });

      const receiptSet = new Set<string>();
      const branchSet = new Set<string>();
      let skippedRows = 0;
      let importedRows = 0;
      let totalRows = 0;
      let lineIndex = 0;
      const chunk: Partial<PosSalesLine>[] = [];

      const flush = async () => {
        if (!chunk.length) return;
        await this.lineRepo
          .createQueryBuilder()
          .insert()
          .into(PosSalesLine)
          .values(chunk)
          .orIgnore()
          .execute();
        chunk.length = 0;
      };

      for (const row of rows) {
        totalRows += 1;
        lineIndex += 1;
        const saleDate = isoDate(row['วันที่']);
        if (!saleDate || !saleDate.startsWith(yearMonth)) {
          skippedRows += 1;
          continue;
        }

        const receiptNo = str(row['เลขที่ใบเสร็จ']);
        const branchCode = str(row['สาขา']);
        if (!receiptNo || !branchCode) {
          skippedRows += 1;
          continue;
        }

        receiptSet.add(receiptNo);
        branchSet.add(branchCode);
        importedRows += 1;

        chunk.push({
          tenantId,
          yearMonth,
          importRunId: run.id,
          lineIndex,
          productName: str(row['ชื่อสินค้า']),
          sku: str(row['รหัสสินค้า']),
          receiptNo,
          saleDate,
          saleDateTime: isoDateTime(row['วันที่เวลา']),
          branchCode,
          qty: String(num(row['จำนวน'])),
          unitCost: String(num(row['ทุน'])),
          unitPrice: String(num(row['ราคา'])),
          lineAmountBeforeVat: String(num(row['มูลค่า'])),
          vatAmount: String(num(row['ภาษี'])),
          lineTotal: String(num(row['รวม'])),
          discount: String(num(row['ส่วนลด'])),
          approvedDiscount: String(num(row['ส่วนลดที่อนุมัติ'])),
          netAmountBeforeVat: String(num(row['มูลค่าหลังหักส่วนลด'])),
          netTotal: String(num(row['รวมหลังหักส่วนลด'])),
          paymentMethod: str(row['การชำระ']),
          nationality: str(row['ลูกค้า']) ?? 'ไม่ระบุ',
          arName: str(row['AR']),
          promotionName: str(row['ชื่อโปรโมชั่น']),
        });

        if (chunk.length >= 2000) await flush();
      }
      await flush();

      run.status = 'completed';
      run.totalRows = totalRows;
      run.importedRows = importedRows;
      run.skippedRows = skippedRows;
      run.receiptCount = receiptSet.size;
      run.branchCount = branchSet.size;
      run.importedAt = new Date();
      run.errorMessage = null;
      return this.runRepo.save(run);
    } catch (err) {
      run.status = 'failed';
      run.errorMessage = (err as Error).message;
      await this.runRepo.save(run);
      this.logger.error(`POS import failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async branchInsights(tenantId: number, yearMonth: string): Promise<Map<string, PosBranchInsight>> {
    const receiptRows = await this.lineRepo
      .createQueryBuilder('l')
      .select('l.branch_code', 'branchCode')
      .addSelect('l.receipt_no', 'receiptNo')
      .addSelect('SUM(l.net_total)', 'receiptTotal')
      .addSelect('MAX(CASE WHEN l.promotion_name IS NULL OR l.promotion_name = "" THEN 0 ELSE 1 END)', 'hasPromo')
      .where('l.tenant_id = :tenantId AND l.year_month = :yearMonth', { tenantId, yearMonth })
      .groupBy('l.branch_code')
      .addGroupBy('l.receipt_no')
      .getRawMany<{ branchCode: string; receiptNo: string; receiptTotal: string; hasPromo: string }>();

    const map = new Map<string, PosBranchInsight>();
    for (const r of receiptRows) {
      const branchCode = r.branchCode;
      const current = map.get(branchCode) ?? {
        branchCode,
        revenue: 0,
        orders: 0,
        avgBill: 0,
        campaignBills: 0,
        campaignConversionPct: null,
        billTierCounts: { gte899: 0, gte999: 0, gte1199: 0, gte3999: 0 },
        topNationalities: [],
        topProducts: [],
        topPromotions: [],
      };
      const receiptTotal = num(r.receiptTotal);
      current.revenue += receiptTotal;
      current.orders += 1;
      if (r.hasPromo === '1') current.campaignBills += 1;
      const tier = classifyTier(receiptTotal);
      if (tier) current.billTierCounts[tier] += 1;
      map.set(branchCode, current);
    }

    for (const row of map.values()) {
      row.avgBill = row.orders > 0 ? Math.round((row.revenue / row.orders) * 100) / 100 : 0;
      row.campaignConversionPct = row.orders > 0
        ? Math.round((row.campaignBills / row.orders) * 1000) / 10
        : null;
      row.revenue = Math.round(row.revenue * 100) / 100;
    }

    const [natRows, productRows, promoRows] = await Promise.all([
      this.topNationalities(tenantId, yearMonth),
      this.topProducts(tenantId, yearMonth),
      this.topPromotions(tenantId, yearMonth),
    ]);
    for (const n of natRows) {
      const row = map.get(n.branchCode);
      if (row) row.topNationalities.push({ nationality: n.nationality, receipts: n.receipts, revenue: n.revenue });
    }
    for (const p of productRows) {
      const row = map.get(p.branchCode);
      if (row) row.topProducts.push({ sku: p.sku, name: p.name, qty: p.qty, revenue: p.revenue });
    }
    for (const p of promoRows) {
      const row = map.get(p.branchCode);
      if (row) row.topPromotions.push({ promotionName: p.promotionName, receipts: p.receipts, revenue: p.revenue });
    }

    return map;
  }

  private async topNationalities(tenantId: number, yearMonth: string) {
    const rows = await this.lineRepo.query(
      `SELECT branch_code branchCode, COALESCE(NULLIF(nationality,''),'ไม่ระบุ') nationality,
        COUNT(DISTINCT receipt_no) receipts, ROUND(SUM(net_total), 2) revenue
       FROM pos_sales_lines
       WHERE tenant_id = ? AND year_month = ?
       GROUP BY branch_code, nationality
       ORDER BY branch_code ASC, receipts DESC`,
      [tenantId, yearMonth],
    ) as Array<{ branchCode: string; nationality: string; receipts: string; revenue: string }>;
    return rows.map((r) => ({
      branchCode: r.branchCode,
      nationality: r.nationality,
      receipts: Number(r.receipts),
      revenue: num(r.revenue),
    }));
  }

  private async topProducts(tenantId: number, yearMonth: string) {
    const rows = await this.lineRepo.query(
      `SELECT branch_code branchCode, COALESCE(sku,'') sku, COALESCE(product_name,'') name,
        ROUND(SUM(qty), 3) qty, ROUND(SUM(net_total), 2) revenue
       FROM pos_sales_lines
       WHERE tenant_id = ? AND year_month = ?
       GROUP BY branch_code, sku, product_name
       ORDER BY branch_code ASC, revenue DESC`,
      [tenantId, yearMonth],
    ) as Array<{ branchCode: string; sku: string; name: string; qty: string; revenue: string }>;
    const counts = new Map<string, number>();
    return rows
      .filter((r) => {
        const n = counts.get(r.branchCode) ?? 0;
        if (n >= 5) return false;
        counts.set(r.branchCode, n + 1);
        return true;
      })
      .map((r) => ({
        branchCode: r.branchCode,
        sku: r.sku,
        name: r.name,
        qty: num(r.qty),
        revenue: num(r.revenue),
      }));
  }

  private async topPromotions(tenantId: number, yearMonth: string) {
    const rows = await this.lineRepo.query(
      `SELECT branch_code branchCode, promotion_name promotionName,
        COUNT(DISTINCT receipt_no) receipts, ROUND(SUM(net_total), 2) revenue
       FROM pos_sales_lines
       WHERE tenant_id = ? AND year_month = ? AND promotion_name IS NOT NULL AND promotion_name <> ''
       GROUP BY branch_code, promotion_name
       ORDER BY branch_code ASC, receipts DESC`,
      [tenantId, yearMonth],
    ) as Array<{ branchCode: string; promotionName: string; receipts: string; revenue: string }>;
    const counts = new Map<string, number>();
    return rows
      .filter((r) => {
        const n = counts.get(r.branchCode) ?? 0;
        if (n >= 5) return false;
        counts.set(r.branchCode, n + 1);
        return true;
      })
      .map((r) => ({
        branchCode: r.branchCode,
        promotionName: r.promotionName,
        receipts: Number(r.receipts),
        revenue: num(r.revenue),
      }));
  }
}
