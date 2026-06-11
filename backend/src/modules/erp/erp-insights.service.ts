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
}

const baht = (v: number) => `฿${Math.round(v).toLocaleString('th-TH')}`;

@Injectable()
export class ErpInsightsService {
  private readonly logger = new Logger(ErpInsightsService.name);

  constructor(
    private readonly erp: ErpService,
    private readonly ai: AiService,
    private readonly openai: OpenAiService,
  ) {}

  async analyze(user: AuthUser, days = 30): Promise<ErpInsightsResult> {
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
        return {
          source: 'ai',
          insights,
          text: result.content,
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        this.logger.warn(`AI insight failed, falling back to heuristic: ${(err as Error).message}`);
      }
    }

    const insights = this.heuristic(facts);
    return {
      source: 'heuristic',
      insights,
      text: insights.map((i) => `- ${i}`).join('\n'),
      generatedAt: new Date().toISOString(),
    };
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
