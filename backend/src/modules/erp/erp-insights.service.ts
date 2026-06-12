import { Injectable, Logger } from '@nestjs/common';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AiService } from '../ai/ai.service';
import { OpenAiService } from '../ai/openai.service';
import { ErpService } from './erp.service';

export interface ErpInsightsResult {
  source: 'ai' | 'heuristic';
  insights: string[];
  text: string;
  generatedAt: string;
  cachedAt?: string;
}

const INSIGHTS_TTL_MS = 20 * 60 * 1_000; // 20 minutes

const baht = (v: number) => `฿${Math.round(v).toLocaleString('th-TH')}`;

@Injectable()
export class ErpInsightsService {
  private readonly logger = new Logger(ErpInsightsService.name);
  private readonly cache = new Map<string, { result: ErpInsightsResult; expiry: number }>();

  constructor(
    private readonly erp: ErpService,
    private readonly ai: AiService,
    private readonly openai: OpenAiService,
  ) {}

  async analyze(user: AuthUser, days = 30, force = false): Promise<ErpInsightsResult> {
    const cacheKey = `${user.tenantId}:${days}`;

    if (!force) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() <= cached.expiry) {
        return { ...cached.result, cachedAt: new Date(cached.expiry - INSIGHTS_TTL_MS).toISOString() };
      }
    }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const fromStr = fmt(from);
    const toStr = fmt(to);

    const [dashboard, summary, branches, products] = await Promise.all([
      this.erp.dashboardSummary(),
      this.erp.salesSummary(fromStr, toStr),
      this.erp.salesByBranch(fromStr, toStr),
      this.erp.topProducts(fromStr, toStr, 5),
    ]);

    const topBranch = branches[0] ?? null;
    const topProduct = products[0] ?? null;
    const discountPct = summary.gross > 0 ? (summary.discount / summary.gross) * 100 : 0;

    // เทียบ 7 วันล่าสุด กับ 7 วันก่อนหน้า จาก trend30
    const trend = dashboard.trend30;
    const last7 = trend.slice(-7).reduce((s, p) => s + p.revenue, 0);
    const prev7 = trend.slice(-14, -7).reduce((s, p) => s + p.revenue, 0);
    const wowPct = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 1000) / 10 : 0;

    const facts = {
      days,
      revenueRange: summary.revenue,
      orders: summary.orders,
      avgTicket: summary.avgTicket,
      discountPct: Math.round(discountPct * 10) / 10,
      wowPct,
      revenueToday: dashboard.revenue.today,
      revenueMonth: dashboard.revenue.month,
      branchCount: dashboard.counts.branches,
      topBranch: topBranch ? { name: topBranch.name, revenue: topBranch.revenue } : null,
      topProduct: topProduct
        ? { name: topProduct.name, revenue: topProduct.revenue, gpPct: topProduct.gpPct }
        : null,
    };

    if (this.openai.isConfigured()) {
      try {
        await this.ai.assertWithinQuota(user.tenantId);
        const system =
          'คุณเป็นนักวิเคราะห์การตลาดสำหรับร้านค้าปลีก (ร้าน 100 บาท) ' +
          'วิเคราะห์ข้อมูลยอดขายจริงและให้คำแนะนำเชิงปฏิบัติเป็นภาษาไทย ' +
          'ตอบเป็นรายการสั้น ๆ 4-6 ข้อ ขึ้นต้นแต่ละข้อด้วย "- " เน้นสิ่งที่ลงมือทำได้ทันที';
        const userPrompt =
          `ข้อมูลยอดขายจาก ERP (ช่วง ${days} วันล่าสุด):\n` +
          JSON.stringify(facts, null, 2) +
          '\n\nช่วยสรุป insight และคำแนะนำการตลาดที่นำไปใช้ได้จริง';
        const result = await this.openai.complete(system, userPrompt);
        await this.ai.addUsage(user.tenantId, result.promptTokens + result.completionTokens);
        const insights = result.content
          .split('\n')
          .map((l) => l.replace(/^[-*•]\s*/, '').trim())
          .filter(Boolean);
        const aiResult: ErpInsightsResult = {
          source: 'ai',
          insights,
          text: result.content,
          generatedAt: new Date().toISOString(),
        };
        this.cache.set(cacheKey, { result: aiResult, expiry: Date.now() + INSIGHTS_TTL_MS });
        return aiResult;
      } catch (err) {
        this.logger.warn(`AI insight failed, falling back to heuristic: ${(err as Error).message}`);
      }
    }

    const hInsights = this.heuristic(facts);
    const hResult: ErpInsightsResult = {
      source: 'heuristic',
      insights: hInsights,
      text: hInsights.map((i) => `- ${i}`).join('\n'),
      generatedAt: new Date().toISOString(),
    };
    this.cache.set(cacheKey, { result: hResult, expiry: Date.now() + INSIGHTS_TTL_MS });
    return hResult;
  }

  /** Generate a short campaign-planning summary (AI or heuristic) */
  async analyzeCampaign(
    user: AuthUser,
    params: {
      campaignName: string;
      targetPrice: number;
      minGpPct: number;
      pieceQty?: number;
    },
    candidates: Array<{
      name: string; sku: string; category: string; brand: string;
      campaignGpPct: number | null; effectiveGpPct?: number; eligibleForTarget: boolean;
      revenue: number; abcCompany: string; minSellPrice: number;
      warnings: string[];
    }>,
  ): Promise<ErpInsightsResult> {
    const eligible  = candidates.filter((c) => c.eligibleForTarget);
    const top10     = eligible.slice(0, 10);
    const qty = params.pieceQty ?? 1;
    const priceLabel = qty > 1 ? `${qty} ชิ้น ฿${params.targetPrice}` : `฿${params.targetPrice}`;

    if (this.openai.isConfigured() && top10.length > 0) {
      try {
        await this.ai.assertWithinQuota(user.tenantId);
        const system =
          'คุณเป็นผู้วางแผนการตลาดของร้าน 100 บาทช็อปไทย ' +
          'วิเคราะห์รายการสินค้าและให้คำแนะนำแคมเปญสั้น ๆ เป็นภาษาไทย ' +
          'ตอบเป็นรายการ 4-6 ข้อ ขึ้นต้นแต่ละข้อด้วย "- " เน้นสิ่งที่ลงมือทำได้จริง';
        const rows = top10
          .map((c, i) =>
            `${i + 1}. ${c.name} (${c.category}) — ` +
            `GP@${priceLabel}: ${(c.effectiveGpPct ?? c.campaignGpPct)?.toFixed(1) ?? 'N/A'}%, ` +
            `ยอดขาย: ฿${Math.round(c.revenue).toLocaleString()}, ABC: ${c.abcCompany}` +
            (c.warnings.length ? `, ⚠ ${c.warnings[0]}` : ''),
          )
          .join('\n');
        const userPrompt =
          `แคมเปญ: "${params.campaignName}" ${priceLabel} GP ขั้นต่ำ ${params.minGpPct}%\n` +
          `สินค้าที่ผ่านเกณฑ์ ${eligible.length} รายการ (แสดง 10 อันดับแรก):\n${rows}\n\n` +
          'กรุณาให้คำแนะนำสั้น ๆ: สินค้ากลุ่มใดควรเลือก, ควรระวังอะไร, และข้อเสนอแนะการจัดแคมเปญ';
        const result = await this.openai.complete(system, userPrompt);
        await this.ai.addUsage(user.tenantId, result.promptTokens + result.completionTokens);
        const insights = result.content
          .split('\n')
          .map((l) => l.replace(/^[-*•\d.]\s*/, '').trim())
          .filter(Boolean);
        return { source: 'ai', insights, text: result.content, generatedAt: new Date().toISOString() };
      } catch (err) {
        this.logger.warn(`Campaign AI summary failed, using heuristic: ${(err as Error).message}`);
      }
    }

    // Heuristic fallback
    return {
      source: 'heuristic',
      insights: this.heuristicCampaign(params, eligible),
      text: '',
      generatedAt: new Date().toISOString(),
    };
  }

  private heuristicCampaign(
    params: { campaignName: string; targetPrice: number; minGpPct: number; pieceQty?: number },
    eligible: Array<{
      name: string; category: string; abcCompany: string;
      campaignGpPct: number | null; effectiveGpPct?: number; revenue: number; warnings: string[];
    }>,
  ): string[] {
    const out: string[] = [];
    const qty = params.pieceQty ?? 1;
    const priceLabel = qty > 1 ? `${qty} ชิ้น ฿${params.targetPrice}` : `฿${params.targetPrice}`;
    out.push(`แคมเปญ "${params.campaignName}" (${priceLabel}) มีสินค้าผ่านเกณฑ์ ${eligible.length} รายการ GP ≥ ${params.minGpPct}%`);

    const aClass = eligible.filter((c) => c.abcCompany === 'ACOM');
    if (aClass.length)
      out.push(`สินค้ากลุ่ม A ที่แนะนำ: ${aClass.slice(0, 3).map((c) => c.name).join(', ')}`);

    const highGp = eligible.filter((c) => (c.campaignGpPct ?? 0) >= 40);
    if (highGp.length)
      out.push(`สินค้า GP สูง ≥40% (กำไรดี): ${highGp.slice(0, 3).map((c) => c.name).join(', ')}`);

    const warned = eligible.filter((c) => c.warnings.length > 0);
    if (warned.length)
      out.push(`${warned.length} รายการมีข้อควรระวัง — ตรวจสอบก่อนประกาศโปร`);

    const cats = [...new Set(eligible.map((c) => c.category).filter(Boolean))];
    if (cats.length)
      out.push(`หมวดสินค้าที่ครอบคลุม: ${cats.slice(0, 4).join(', ')}`);

    return out;
  }

  private heuristic(f: {
    days: number;
    revenueRange: number;
    orders: number;
    avgTicket: number;
    discountPct: number;
    wowPct: number;
    branchCount: number;
    topBranch: { name: string; revenue: number } | null;
    topProduct: { name: string; revenue: number; gpPct: number } | null;
  }): string[] {
    const out: string[] = [];

    out.push(
      `ช่วง ${f.days} วันล่าสุด ทำยอดขายรวม ${baht(f.revenueRange)} จาก ${f.orders.toLocaleString('th-TH')} บิล ` +
        `(เฉลี่ย ${baht(f.avgTicket)}/บิล)`,
    );

    if (f.wowPct > 0) {
      out.push(`ยอดขาย 7 วันล่าสุดโต ${f.wowPct}% เทียบสัปดาห์ก่อน — เพิ่มงบให้แคมเปญที่กำลังเวิร์ก`);
    } else if (f.wowPct < 0) {
      out.push(`ยอดขาย 7 วันล่าสุดลด ${Math.abs(f.wowPct)}% เทียบสัปดาห์ก่อน — จัดโปรกระตุ้นและดันสินค้าขายดี`);
    } else {
      out.push('ยอดขายรายสัปดาห์ทรงตัว — ลองทดสอบโปรโมชันใหม่เพื่อสร้างการเติบโต');
    }

    if (f.topBranch) {
      out.push(
        `สาขาทำยอดสูงสุดคือ "${f.topBranch.name}" (${baht(f.topBranch.revenue)}) — ถอดบทเรียนไปปรับใช้สาขาอื่น`,
      );
    }

    if (f.topProduct) {
      const gpNote = f.topProduct.gpPct < 15 ? ' (GP ค่อนข้างต่ำ ควรจับคู่ขายสินค้ากำไรสูง)' : '';
      out.push(
        `สินค้าขายดีอันดับ 1 คือ "${f.topProduct.name}" (${baht(f.topProduct.revenue)}, GP ${f.topProduct.gpPct}%)${gpNote}`,
      );
    }

    if (f.discountPct >= 12) {
      out.push(`สัดส่วนส่วนลดสูงถึง ${f.discountPct}% ของยอดก่อนลด — ทบทวนความคุ้มค่าของโปรโมชัน`);
    } else {
      out.push(`สัดส่วนส่วนลดอยู่ที่ ${f.discountPct}% ของยอดก่อนลด — อยู่ในเกณฑ์ที่จัดการได้`);
    }

    return out;
  }
}
