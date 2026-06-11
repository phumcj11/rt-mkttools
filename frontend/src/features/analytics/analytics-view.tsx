'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BarChart3,
  Database,
  Download,
  Loader2,
  Receipt,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Badge, BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { ApiError } from '@/lib/api';
import {
  generateSampleSales,
  getAnalyticsSummary,
  getCampaignStatus,
  getSalesSeries,
  getTopProducts,
  listSalesRecords,
} from '@/lib/analytics-api';
import { listBranches } from '@/lib/branches-api';
import type {
  AnalyticsSummary,
  Branch,
  CampaignStatusCount,
  SalesPoint,
  TopProduct,
} from '@/lib/types';

const PERIODS = [7, 30, 90];

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  draft: 'muted',
  scheduled: 'warning',
  running: 'success',
  completed: 'secondary',
  archived: 'muted',
};

function formatBaht(value: number): string {
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

export function AnalyticsView() {
  const t = useTranslations('analyticsPage');
  const tc = useTranslations('campaigns.statusValues');

  const [days, setDays] = useState(30);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [series, setSeries] = useState<SalesPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatusCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, ser, tp, cs] = await Promise.all([
        getAnalyticsSummary(days, branchId),
        getSalesSeries(days, branchId),
        getTopProducts(days, 5, branchId),
        getCampaignStatus(),
      ]);
      setSummary(s);
      setSeries(ser);
      setTopProducts(tp);
      setCampaignStatus(cs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [days, branchId]);

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onGenerateSample() {
    setSeeding(true);
    setError(null);
    try {
      await generateSampleSales();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setSeeding(false);
    }
  }

  async function onExport() {
    setExporting(true);
    try {
      const rows = await listSalesRecords(days, branchId);
      const header = ['id', 'soldAt', 'productId', 'campaignId', 'quantity', 'amount'];
      const lines = [
        header.join(','),
        ...rows.map((r) =>
          [
            r.id,
            new Date(r.soldAt).toISOString(),
            r.productId ?? '',
            r.campaignId ?? '',
            r.quantity,
            r.amount,
          ].join(','),
        ),
      ];
      const blob = new Blob(['\uFEFF' + lines.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setExporting(false);
    }
  }

  const maxSales = useMemo(
    () => Math.max(1, ...series.map((p) => p.total)),
    [series],
  );
  const maxProduct = useMemo(
    () => Math.max(1, ...topProducts.map((p) => p.total)),
    [topProducts],
  );

  const isEmpty = !loading && summary?.totalOrders === 0;

  const cards: { key: string; value: string; icon: LucideIcon; tone: string }[] = [
    {
      key: 'totalSales',
      value: formatBaht(summary?.totalSales ?? 0),
      icon: TrendingUp,
      tone: 'text-primary',
    },
    {
      key: 'totalOrders',
      value: (summary?.totalOrders ?? 0).toLocaleString('th-TH'),
      icon: ShoppingCart,
      tone: 'text-gold',
    },
    {
      key: 'avgOrderValue',
      value: formatBaht(summary?.avgOrderValue ?? 0),
      icon: Receipt,
      tone: 'text-primary',
    },
    {
      key: 'aiTokens',
      value: (summary?.aiTokens ?? 0).toLocaleString('th-TH'),
      icon: Sparkles,
      tone: 'text-gold',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            value={branchId ?? ''}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : null)}
            className="w-auto max-w-[180px]"
            aria-label={t('filterBranch')}
          >
            <option value="">{t('allBranches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-auto"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {t('lastDays', { days: p })}
              </option>
            ))}
          </NativeSelect>
          <Button variant="outline" onClick={onExport} disabled={exporting || isEmpty}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('exportCsv')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.key}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t(c.key)}
                    </CardTitle>
                    <Icon className={`h-5 w-5 ${c.tone}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{c.value}</div>
                    <p className="text-xs text-muted-foreground">
                      {t('lastDays', { days })}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {isEmpty && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Database className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('emptyData')}</p>
                <Button onClick={onGenerateSample} disabled={seeding}>
                  {seeding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {t('generateSample')}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                {t('salesTrend')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-56 items-end gap-[2px]">
                {series.map((p) => (
                  <div
                    key={p.date}
                    className="group relative flex flex-1 items-end"
                    style={{ minWidth: 2 }}
                  >
                    <div
                      className="w-full rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary"
                      style={{ height: `${(p.total / maxSales) * 100}%` }}
                    />
                    <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[11px] text-background opacity-0 shadow group-hover:opacity-100">
                      {p.date} · {formatBaht(p.total)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{series[0]?.date}</span>
                <span>{series[series.length - 1]?.date}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('topProducts')}</CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t('noProducts')}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {topProducts.map((p, i) => (
                      <li key={p.productId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-medium">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">
                              {i + 1}
                            </span>
                            {p.name}
                          </span>
                          <span className="text-muted-foreground">{formatBaht(p.total)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gold"
                            style={{ width: `${(p.total / maxProduct) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('campaignStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                {campaignStatus.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t('noCampaigns')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {campaignStatus.map((c) => (
                      <li
                        key={c.status}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <Badge variant={STATUS_VARIANT[c.status] ?? 'muted'}>
                          {STATUS_VARIANT[c.status] ? tc(c.status) : c.status}
                        </Badge>
                        <span className="font-semibold">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
