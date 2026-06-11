'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3, Building2, Lightbulb, Loader2, Package,
  RefreshCw, ShoppingCart, Sparkles, Star, TrendingDown, TrendingUp, Radio,
  MessageCircle, AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getErpDashboard,
  getErpSalesSummary,
  getErpSalesByBranch,
  getErpTopProducts,
  getErpAiInsights,
  getErpAlerts,
} from '@/lib/erp-api';
import { getExecutiveSummary } from '@/lib/analytics-api';
import type { ErpDashboard, ErpBranchSales, ErpTopProduct, ErpInsights, ErpAlert, ExecutiveSummary } from '@/lib/types';
import { useAuthStore } from '@/stores/auth-store';

function formatBaht(value: number): string {
  if (value >= 1_000_000) return `฿${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `฿${(value / 1_000).toFixed(0)}K`;
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

export function DashboardView() {
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);

  const [erpDash, setErpDash]       = useState<ErpDashboard | null>(null);
  const [erpSummary, setErpSummary] = useState<{ orders: number; revenue: number } | null>(null);
  const [byBranch, setByBranch]     = useState<ErpBranchSales[]>([]);
  const [topProducts, setTopProducts] = useState<ErpTopProduct[]>([]);
  const [insights, setInsights]     = useState<ErpInsights | null>(null);
  const [alerts, setAlerts]         = useState<ErpAlert[]>([]);
  const [executive, setExecutive]   = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      getErpDashboard().then(setErpDash),
      getErpSalesSummary(30).then(setErpSummary),
      getErpSalesByBranch(30).then(setByBranch),
      getErpTopProducts(30, 8).then(setTopProducts),
      getErpAiInsights(30).then(setInsights),
      getErpAlerts().then(setAlerts),
      getExecutiveSummary(30).then(setExecutive),
    ]).finally(() => {
      setLoading(false);
      setLastUpdate(new Date());
    });
  };

  useEffect(load, []);

  const branchRevTotal = byBranch.reduce((s, b) => s + b.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">แดชบอร์ดผู้บริหาร</h1>
          <p className="text-muted-foreground text-sm">
            {tenant?.name ?? '100 Baht Shop Thailand'} — ข้อมูลจาก ChangeSiam ERP
            {lastUpdate && (
              <span className="ml-2 text-xs">อัปเดต: {lastUpdate.toLocaleTimeString('th-TH')}</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </Button>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                alert.level === 'warning'
                  ? 'bg-yellow-500/10 text-yellow-700 border border-yellow-500/30'
                  : alert.level === 'success'
                    ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30'
                    : 'bg-blue-500/10 text-blue-700 border border-blue-500/30'
              }`}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {alert.message}
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-3">
          ยอดขาย ERP (30 วันล่าสุด)
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="ยอดขายรวม"
            icon={BarChart3}
            tone="text-primary"
            loading={loading}
            value={erpSummary ? formatBaht(erpSummary.revenue) : erpDash ? formatBaht(erpDash.revenue.month) : null}
            sub="เดือนนี้"
          />
          <KpiCard
            label="ออเดอร์"
            icon={ShoppingCart}
            tone="text-primary"
            loading={loading}
            value={erpSummary ? erpSummary.orders.toLocaleString('th-TH') : null}
            sub="รายการ"
          />
          <KpiCard
            label="สาขาทั้งหมด"
            icon={Building2}
            tone="text-gold"
            loading={loading}
            value={erpDash ? erpDash.counts.branches.toLocaleString('th-TH') : null}
            sub="สาขา"
          />
          <KpiCard
            label="สินค้าในระบบ"
            icon={Package}
            tone="text-gold"
            loading={loading}
            value={erpDash ? erpDash.counts.products.toLocaleString('th-TH') : null}
            sub="รายการ"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-3">
          KPI ภาพรวม
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <GrowthCard
            label="การเติบโตยอดขาย"
            growth={executive?.growth.sales ?? null}
            loading={loading}
          />
          <GrowthCard
            label="การเติบโตออเดอร์"
            growth={executive?.growth.orders ?? null}
            loading={loading}
          />
          <KpiCard
            label="ห้องสนทนา AI"
            icon={MessageCircle}
            tone="text-primary"
            loading={loading}
            value={executive ? (executive.kpis.chatThreads ?? 0).toLocaleString('th-TH') : null}
            sub={`${(executive?.kpis.chatMessages ?? 0).toLocaleString('th-TH')} ข้อความ`}
          />
          <KpiCard
            label="Google Review"
            icon={Star}
            tone="text-gold"
            loading={loading}
            value="—"
            sub={<span className="text-muted-foreground">เร็ว ๆ นี้</span>}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              ยอดขายรายสาขา (ERP จริง)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Spinner />
            ) : byBranch.length === 0 ? (
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
            {loading ? (
              <Spinner />
            ) : topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลสินค้า</p>
            ) : (
              <ul className="space-y-2">
                {topProducts.slice(0, 6).map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground shrink-0">
                      #{i + 1}
                    </span>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-gold" />
            AI Insight
            {insights?.source === 'ai' && (
              <Badge variant="default" className="ml-1 text-[10px]">
                <Sparkles className="mr-1 h-2.5 w-2.5" />
                OpenAI
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
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
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลเชิงลึกในช่วงนี้</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed opacity-75">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Social Listening & Google Review KPIs</p>
              <p className="text-xs text-muted-foreground">จะแสดงข้อมูลจริงเมื่อเชื่อมต่อ APIs (พัฒนาต่อเนื่อง)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            `${positive ? '+' : ''}${(growth ?? 0).toLocaleString('th-TH')}%`
          )}
        </div>
        <p className="text-xs text-muted-foreground">เทียบช่วงก่อนหน้า</p>
      </CardContent>
    </Card>
  );
}
