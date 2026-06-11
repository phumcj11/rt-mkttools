'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BarChart3,
  Building2,
  Lightbulb,
  Loader2,
  Megaphone,
  Package,
  Sparkles,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAnalyticsSummary,
  getExecutiveSummary,
  getSalesByBranch,
  getSalesByCategory,
} from '@/lib/analytics-api';
import type {
  AnalyticsSummary,
  BranchSalesPoint,
  CategorySalesPoint,
  ExecutiveSummary,
} from '@/lib/types';
import { useAuthStore } from '@/stores/auth-store';

interface Stat {
  key: string;
  icon: LucideIcon;
  tone: string;
  value: (s: AnalyticsSummary) => string;
}

const STATS: Stat[] = [
  {
    key: 'totalSales',
    icon: BarChart3,
    tone: 'text-primary',
    value: (s) => `฿${Math.round(s.totalSales).toLocaleString('th-TH')}`,
  },
  {
    key: 'activeCampaigns',
    icon: Megaphone,
    tone: 'text-gold',
    value: (s) => s.activeCampaigns.toLocaleString('th-TH'),
  },
  {
    key: 'totalProducts',
    icon: Package,
    tone: 'text-primary',
    value: (s) => s.totalProducts.toLocaleString('th-TH'),
  },
  {
    key: 'aiUsage',
    icon: Sparkles,
    tone: 'text-gold',
    value: (s) => s.aiTokens.toLocaleString('th-TH'),
  },
];

function formatBaht(value: number): string {
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

export function DashboardView() {
  const t = useTranslations('dashboard');
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [executive, setExecutive] = useState<ExecutiveSummary | null>(null);
  const [byBranch, setByBranch] = useState<BranchSalesPoint[]>([]);
  const [byCategory, setByCategory] = useState<CategorySalesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      getAnalyticsSummary(30),
      getExecutiveSummary(30),
      getSalesByBranch(30),
      getSalesByCategory(30),
    ])
      .then(([s, exec, branch, category]) => {
        if (!active) return;
        setSummary(s);
        setExecutive(exec);
        setByBranch(branch);
        setByCategory(category);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const branchTotal = byBranch.reduce((sum, b) => sum + b.total, 0);
  const categoryTotal = byCategory.reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('welcome')}, {tenant?.name ?? user?.fullName ?? user?.email}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t(stat.key)}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.tone}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : summary ? (
                    stat.value(summary)
                  ) : (
                    '—'
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t('thisMonth')}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t('executiveTitle')}</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GrowthCard
          label={t('salesGrowth')}
          hint={t('vsPrevious')}
          growth={executive?.growth.sales ?? null}
          loading={loading}
        />
        <GrowthCard
          label={t('ordersGrowth')}
          hint={t('vsPrevious')}
          growth={executive?.growth.orders ?? null}
          loading={loading}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('branchCount')}
            </CardTitle>
            <Building2 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                (executive?.branchCount ?? 0).toLocaleString('th-TH')
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('topBranch')}
            </CardTitle>
            <Building2 className="h-5 w-5 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-lg font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : executive?.topBranch ? (
                executive.topBranch.name
              ) : (
                '—'
              )}
            </div>
            {executive?.topBranch && (
              <p className="text-xs text-muted-foreground">
                {formatBaht(executive.topBranch.total)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              {t('salesByBranch')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : byBranch.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('noBranchSales')}
              </p>
            ) : (
              <BreakdownList
                items={byBranch.map((b) => ({
                  key: String(b.branchId ?? 'none'),
                  name: b.name,
                  total: b.total,
                  meta: `${b.orders.toLocaleString('th-TH')} ${t('orders')}`,
                }))}
                grandTotal={branchTotal}
                barClass="bg-primary"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-gold" />
              {t('salesByCategory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : byCategory.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('noCategorySales')}
              </p>
            ) : (
              <BreakdownList
                items={byCategory.map((c) => ({
                  key: String(c.categoryId ?? 'none'),
                  name: c.name,
                  total: c.total,
                  meta: `${c.quantity.toLocaleString('th-TH')}`,
                }))}
                grandTotal={categoryTotal}
                barClass="bg-gold"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-gold" />
            {t('aiInsights')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : executive && executive.insights.length > 0 ? (
            <ul className="space-y-3">
              {executive.insights.map((insight, idx) => (
                <li key={idx} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('noInsights')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GrowthCard({
  label,
  hint,
  growth,
  loading,
}: {
  label: string;
  hint: string;
  growth: number | null;
  loading: boolean;
}) {
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
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownList({
  items,
  grandTotal,
  barClass,
}: {
  items: { key: string; name: string; total: number; meta: string }[];
  grandTotal: number;
  barClass: string;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = grandTotal > 0 ? Math.round((item.total / grandTotal) * 100) : 0;
        return (
          <li key={item.key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate pr-2 font-medium">{item.name}</span>
              <span className="tabular-nums text-muted-foreground">{formatBaht(item.total)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{item.meta}</span>
              <span>{pct}%</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
