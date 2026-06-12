'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3, Building2, CalendarDays, Lightbulb, Loader2, Package,
  RefreshCw, ShoppingCart, Sparkles, Star, TrendingDown, TrendingUp,
  MessageCircle, AlertCircle, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getErpDashboard,
  getErpSalesSummary,
  getErpSalesByBranch,
  getErpTopProducts,
  getErpAiInsights,
  getErpAlerts,
} from '@/lib/erp-api';
import { getExecutiveSummary } from '@/lib/analytics-api';
import type { ErpDashboard, ErpBranchSales, ErpSalesSummary, ErpTopProduct, ErpInsights, ErpAlert, ExecutiveSummary } from '@/lib/types';
import { useAuthStore } from '@/stores/auth-store';

// ─── Types ────────────────────────────────────────────────────────────────────

type RangeKey = 'today' | '7d' | '30d' | 'month' | 'custom';

interface DateRange {
  key: RangeKey;
  label: string;
  days: number;
  from: string;
  to: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const today = () => fmt(new Date());

function buildRange(key: RangeKey, customFrom?: string, customTo?: string): DateRange {
  const t = today();
  switch (key) {
    case 'today':
      return { key, label: 'วันนี้', days: 1, from: t, to: t };
    case '7d': {
      const f = new Date(); f.setDate(f.getDate() - 6);
      return { key, label: '7 วัน', days: 7, from: fmt(f), to: t };
    }
    case 'month': {
      const now = new Date();
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { key, label: 'เดือนนี้', days: now.getDate(), from: fmt(f), to: t };
    }
    case 'custom': {
      const f = customFrom || t;
      const tEnd = customTo || t;
      const diff = Math.max(1, Math.round((new Date(tEnd).getTime() - new Date(f).getTime()) / 86_400_000) + 1);
      return { key, label: 'กำหนดเอง', days: diff, from: f, to: tEnd };
    }
    default: { // 30d
      const f = new Date(); f.setDate(f.getDate() - 29);
      return { key, label: '30 วัน', days: 30, from: fmt(f), to: t };
    }
  }
}

function formatBaht(value: number): string {
  if (value >= 1_000_000) return `฿${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `฿${(value / 1_000).toFixed(0)}K`;
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

const RANGE_OPTIONS: RangeKey[] = ['today', '7d', '30d', 'month', 'custom'];
const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'วันนี้',
  '7d': '7 วัน',
  '30d': '30 วัน',
  month: 'เดือนนี้',
  custom: 'กำหนดเอง',
};

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardView() {
  const tenant = useAuthStore((s) => s.tenant);

  // Range state
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d');
  const [customFrom, setCustomFrom] = useState(today());
  const [customTo, setCustomTo]     = useState(today());
  const [showCustom, setShowCustom] = useState(false);
  const range = buildRange(rangeKey, customFrom, customTo);

  // Data state
  const [erpDash, setErpDash]         = useState<ErpDashboard | null>(null);
  const [erpSummary, setErpSummary]   = useState<ErpSalesSummary | null>(null);
  const [byBranch, setByBranch]       = useState<ErpBranchSales[]>([]);
  const [topProducts, setTopProducts] = useState<ErpTopProduct[]>([]);
  const [alerts, setAlerts]           = useState<ErpAlert[]>([]);
  const [executive, setExecutive]     = useState<ExecutiveSummary | null>(null);

  // AI insights — loaded separately, not on mount
  const [insights, setInsights]         = useState<ErpInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsCachedAt, setInsightsCachedAt] = useState<string | null>(null);

  // Loading states
  const [loading, setLoading]       = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // ─── Load critical data ─────────────────────────────────────────────────────

  const load = useCallback((force = false) => {
    setLoading(true);
    const opts = { from: range.from, to: range.to, force };
    Promise.allSettled([
      getErpDashboard(force).then(setErpDash),
      getErpSalesSummary(range.days, opts).then(setErpSummary),
      getErpSalesByBranch(range.days, opts).then(setByBranch),
      getErpTopProducts(range.days, 8, opts).then(setTopProducts),
      getErpAlerts().then(setAlerts),
      getExecutiveSummary(range.days).then(setExecutive),
    ]).finally(() => {
      setLoading(false);
      setLastUpdate(new Date());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, range.days]);

  // Reload when range changes
  useEffect(() => { load(false); }, [load]);

  // ─── Load AI Insights on demand ────────────────────────────────────────────

  const loadInsights = async (force = false) => {
    setInsightsLoading(true);
    try {
      const data = await getErpAiInsights(range.days, force);
      setInsights(data);
      setInsightsCachedAt((data as any).cachedAt ?? null);
    } catch { /* ignore */ }
    setInsightsLoading(false);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const branchRevTotal = byBranch.reduce((s, b) => s + b.revenue, 0);
  const revenueValue = rangeKey === 'today'
    ? (erpDash ? formatBaht(erpDash.revenue.today) : null)
    : (erpSummary ? formatBaht(erpSummary.revenue) : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">แดชบอร์ดผู้บริหาร</h1>
          <p className="text-muted-foreground text-sm">
            {tenant?.name ?? '100 Baht Shop Thailand'} — ข้อมูลจาก ChangeSiam ERP
            {lastUpdate && (
              <span className="ml-2 text-xs opacity-70">
                อัปเดต: {lastUpdate.toLocaleTimeString('th-TH')}
                {' · cache สั้น 5 นาที'}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Range selector */}
          <div className="flex rounded-lg border bg-muted/50 p-0.5">
            {RANGE_OPTIONS.map((key) => (
              <button
                key={key}
                onClick={() => {
                  setRangeKey(key);
                  setShowCustom(key === 'custom');
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  rangeKey === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>

          {/* Force refresh */}
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Custom range picker */}
      {showCustom && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input type="date" className="h-8 w-36 text-sm" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-muted-foreground text-sm">–</span>
            <Input type="date" className="h-8 w-36 text-sm" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
          <Button size="sm" variant="default" onClick={() => load(false)}>ดูข้อมูล</Button>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${
                alert.level === 'warning'
                  ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30'
                  : alert.level === 'success'
                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                    : 'bg-blue-500/10 text-blue-700 border-blue-500/30'
              }`}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* ERP KPIs */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-3">
          ยอดขาย ERP ({range.label})
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="ยอดขายรวม" icon={BarChart3} tone="text-primary" loading={loading}
            value={revenueValue}
            sub={rangeKey === 'today' ? 'วันนี้' : `${range.label}ล่าสุด`}
          />
          <KpiCard label="ออเดอร์" icon={ShoppingCart} tone="text-primary" loading={loading}
            value={erpSummary ? erpSummary.orders.toLocaleString('th-TH') : null}
            sub="รายการ"
          />
          <KpiCard label="สาขาทั้งหมด" icon={Building2} tone="text-gold" loading={loading}
            value={erpDash ? erpDash.counts.branches.toLocaleString('th-TH') : null}
            sub="สาขา"
          />
          <KpiCard label="สินค้าในระบบ" icon={Package} tone="text-gold" loading={loading}
            value={erpDash ? erpDash.counts.products.toLocaleString('th-TH') : null}
            sub="รายการ"
          />
        </div>
      </div>

      {/* KPI growth */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-3">
          KPI ภาพรวม
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <GrowthCard label="การเติบโตยอดขาย" growth={executive?.growth.sales ?? null} loading={loading} />
          <GrowthCard label="การเติบโตออเดอร์" growth={executive?.growth.orders ?? null} loading={loading} />
          <KpiCard label="ห้องสนทนา AI" icon={MessageCircle} tone="text-primary" loading={loading}
            value={executive ? (executive.kpis.chatThreads ?? 0).toLocaleString('th-TH') : null}
            sub={`${(executive?.kpis.chatMessages ?? 0).toLocaleString('th-TH')} ข้อความ`}
          />
          <KpiCard label="Google Review" icon={Star} tone="text-gold" loading={loading}
            value="—"
            sub={<span className="text-muted-foreground">เร็ว ๆ นี้</span>}
          />
        </div>
      </div>

      {/* Branch & Top products */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              ยอดขายรายสาขา (ERP จริง)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Spinner /> : byBranch.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลสาขา</p>
            ) : (
              <ul className="space-y-3">
                {byBranch.slice(0, 6).map((b) => {
                  const pct = branchRevTotal > 0 ? Math.round((b.revenue / branchRevTotal) * 100) : 0;
                  return (
                    <li key={b.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate pr-2">{b.name}</span>
                        <span className="tabular-nums text-muted-foreground shrink-0">{formatBaht(b.revenue)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{b.orders.toLocaleString('th-TH')} ออเดอร์</span>
                        <span>{pct}%</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-gold" />
              สินค้าขายดี (ERP จริง)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Spinner /> : topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลสินค้า</p>
            ) : (
              <ul className="space-y-2">
                {topProducts.slice(0, 6).map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">{formatBaht(p.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{p.qtySold.toLocaleString('th-TH')} ชิ้น</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights — lazy load */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-gold" />
              AI Insight
              {insights?.source === 'ai' && (
                <Badge variant="default" className="ml-1 text-[10px]">
                  <Sparkles className="mr-1 h-2.5 w-2.5" />OpenAI
                </Badge>
              )}
              {insightsCachedAt && (
                <span className="text-xs text-muted-foreground font-normal">
                  · cache {new Date(insightsCachedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {insights && (
                <Button variant="ghost" size="sm" disabled={insightsLoading} onClick={() => void loadInsights(true)}>
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
                  สร้างใหม่
                </Button>
              )}
              {!insights && (
                <Button variant="outline" size="sm" disabled={insightsLoading} onClick={() => void loadInsights(false)}>
                  {insightsLoading
                    ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />กำลังวิเคราะห์...</>
                    : <><Zap className="mr-1.5 h-3.5 w-3.5" />สร้าง AI Insight</>
                  }
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {insightsLoading && !insights ? (
            <Spinner />
          ) : insights && insights.insights.length > 0 ? (
            <ul className="space-y-3">
              {insights.insights.map((insight, idx) => (
                <li key={idx} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          ) : executive && executive.insights.length > 0 ? (
            <ul className="space-y-3">
              {executive.insights.map((insight, idx) => (
                <li key={idx} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          ) : !insightsLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              กด "สร้าง AI Insight" เพื่อวิเคราะห์ข้อมูลยอดขายด้วย AI
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function KpiCard({
  label, icon: Icon, tone, loading, value, sub,
}: {
  label: string;
  icon: typeof BarChart3;
  tone: string;
  loading: boolean;
  value: string | null;
  sub: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${tone}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (value ?? '—')}
        </div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function GrowthCard({ label, growth, loading }: { label: string; growth: number | null; loading: boolean }) {
  const positive = (growth ?? 0) >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const tone = positive ? 'text-emerald-500' : 'text-destructive';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${tone}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${loading ? '' : tone}`}>
          {loading
            ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            : `${positive ? '+' : ''}${(growth ?? 0).toLocaleString('th-TH')}%`
          }
        </div>
        <p className="text-xs text-muted-foreground">เทียบช่วงก่อนหน้า</p>
      </CardContent>
    </Card>
  );
}
