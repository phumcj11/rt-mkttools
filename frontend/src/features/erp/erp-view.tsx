'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Banknote,
  Building2,
  Gift,
  Loader2,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api';
import {
  getErpDashboard,
  getErpPromotions,
  getErpSalesByBranch,
  getErpSalesSummary,
  getErpTopProducts,
} from '@/lib/erp-api';
import type {
  ErpBranchSales,
  ErpDashboard,
  ErpPromotion,
  ErpSalesSummary,
  ErpTopProduct,
} from '@/lib/types';

const RANGES = [7, 30, 90] as const;

function baht(value: number): string {
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

function num(value: number): string {
  return value.toLocaleString('th-TH');
}

export function ErpView() {
  const t = useTranslations('erp');

  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<ErpDashboard | null>(null);
  const [summary, setSummary] = useState<ErpSalesSummary | null>(null);
  const [byBranch, setByBranch] = useState<ErpBranchSales[]>([]);
  const [topProducts, setTopProducts] = useState<ErpTopProduct[]>([]);
  const [promotions, setPromotions] = useState<ErpPromotion[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, s, b, p, promos] = await Promise.all([
        getErpDashboard(),
        getErpSalesSummary(days),
        getErpSalesByBranch(days),
        getErpTopProducts(days, 10),
        getErpPromotions(12),
      ]);
      setDashboard(d);
      setSummary(s);
      setByBranch(b);
      setTopProducts(p);
      setPromotions(promos);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('unavailable'));
    } finally {
      setLoading(false);
    }
  }, [days, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxTrend = Math.max(1, ...(dashboard?.trend30.map((p) => p.revenue) ?? [1]));

  const kpis = dashboard
    ? [
        { label: t('kpi.revenueToday'), value: baht(dashboard.revenue.today), icon: Banknote, tone: 'text-primary' },
        { label: t('kpi.revenueMonth'), value: baht(dashboard.revenue.month), icon: TrendingUp, tone: 'text-gold' },
        { label: t('kpi.ordersToday'), value: num(dashboard.ordersToday), icon: ShoppingCart, tone: 'text-primary' },
        { label: t('kpi.branches'), value: num(dashboard.counts.branches), icon: Building2, tone: 'text-gold' },
        { label: t('kpi.products'), value: num(dashboard.counts.products), icon: Package, tone: 'text-primary' },
        { label: t('kpi.customers'), value: num(dashboard.counts.customers), icon: Users, tone: 'text-gold' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border bg-card p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                className={`rounded px-3 py-1 text-sm transition-colors ${
                  days === r
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`ranges.${r}`)}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !dashboard ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{k.label}</span>
                    <k.icon className={`h-4 w-4 ${k.tone}`} />
                  </div>
                  <span className="text-xl font-bold tracking-tight">{k.value}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t('trend.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-48 items-end gap-1">
                  {(dashboard?.trend30 ?? []).map((p) => (
                    <div
                      key={p.date}
                      className="group relative flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
                      style={{ height: `${Math.max(4, (p.revenue / maxTrend) * 100)}%` }}
                      title={`${p.date} · ${baht(p.revenue)} · ${num(p.orders)}`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('rangeSummary.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label={t('rangeSummary.revenue')} value={baht(summary?.revenue ?? 0)} strong />
                <Row label={t('rangeSummary.orders')} value={num(summary?.orders ?? 0)} />
                <Row label={t('rangeSummary.gross')} value={baht(summary?.gross ?? 0)} />
                <Row label={t('rangeSummary.discount')} value={baht(summary?.discount ?? 0)} />
                <Row label={t('rangeSummary.avgTicket')} value={baht(summary?.avgTicket ?? 0)} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('byBranch.title')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('byBranch.branch')}</TableHead>
                      <TableHead className="text-right">{t('byBranch.orders')}</TableHead>
                      <TableHead className="text-right">{t('byBranch.revenue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byBranch.slice(0, 12).map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {num(b.orders)}
                        </TableCell>
                        <TableCell className="text-right">{baht(b.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('topProducts.title')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('topProducts.product')}</TableHead>
                      <TableHead className="text-right">{t('topProducts.qty')}</TableHead>
                      <TableHead className="text-right">{t('topProducts.revenue')}</TableHead>
                      <TableHead className="text-right">{t('topProducts.gp')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.category}</div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {num(p.qtySold)}
                        </TableCell>
                        <TableCell className="text-right">{baht(p.revenue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {p.gpPct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-4 w-4 text-gold" />
                {t('promotions.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('promotions.name')}</TableHead>
                    <TableHead>{t('promotions.type')}</TableHead>
                    <TableHead>{t('promotions.period')}</TableHead>
                    <TableHead className="text-right">{t('promotions.products')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-md">
                        <div className="truncate font-medium" title={p.name}>
                          {p.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.code}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.typeName || p.type}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.dateStart} – {p.dateStop}
                      </TableCell>
                      <TableCell className="text-right">{num(p.productCount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'text-base font-bold' : 'font-medium'}>{value}</span>
    </div>
  );
}
