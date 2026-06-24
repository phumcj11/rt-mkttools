'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  Gift,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
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
  getCommandCenter,
  upsertCustomerMix,
  upsertSalesTargets,
  upsertTraffic,
  type BranchHealthRow,
  type CommandCenterData,
} from '@/lib/revenue-api';
import { showError, showSuccess } from '@/lib/sweetalert';

function baht(value: number): string {
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

function pct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}%`;
}

function statusBadge(status: BranchHealthRow['status']) {
  if (status === 'green') return <Badge className="bg-emerald-600 hover:bg-emerald-600">โต</Badge>;
  if (status === 'yellow') return <Badge variant="secondary">ทรงตัว</Badge>;
  return <Badge variant="destructive">ยอดตก</Badge>;
}

function severityClass(severity: string) {
  if (severity === 'high') return 'border-red-200 bg-red-50 text-red-900';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function RevenueCommandCenterView() {
  const t = useTranslations('revenue');

  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [trafficBranchId, setTrafficBranchId] = useState('');
  const [trafficDate, setTrafficDate] = useState('');
  const [trafficFoot, setTrafficFoot] = useState('');
  const [trafficTx, setTrafficTx] = useState('');
  const [mixBranchId, setMixBranchId] = useState('');
  const [mixDate, setMixDate] = useState('');
  const [mixType, setMixType] = useState('family');
  const [mixCount, setMixCount] = useState('');

  const yearMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCommandCenter({ force });
      setData(res);
      if (res.kpi.targetRevenue) {
        setTargetInput(String(Math.round(res.kpi.targetRevenue)));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('unavailable'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveTarget = async () => {
    const amount = parseFloat(targetInput.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      showError(t('target.invalid'));
      return;
    }
    setSavingTarget(true);
    try {
      await upsertSalesTargets([
        { yearMonth, branchId: null, targetRevenue: amount },
      ]);
      showSuccess(t('target.saved'));
      await load(true);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('target.failed'));
    } finally {
      setSavingTarget(false);
    }
  };

  const handleSaveTraffic = async () => {
    const branchId = parseInt(trafficBranchId, 10);
    const footTraffic = parseInt(trafficFoot, 10);
    if (!trafficDate || !Number.isFinite(branchId) || !Number.isFinite(footTraffic)) {
      showError(t('setup.invalid'));
      return;
    }
    try {
      await upsertTraffic([
        {
          branchId,
          trafficDate,
          footTraffic,
          transactions: trafficTx ? parseInt(trafficTx, 10) : null,
        },
      ]);
      showSuccess(t('setup.trafficSaved'));
      await load(true);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('setup.failed'));
    }
  };

  const handleSaveMix = async () => {
    const branchId = parseInt(mixBranchId, 10);
    const count = parseInt(mixCount, 10);
    if (!mixDate || !Number.isFinite(branchId) || !Number.isFinite(count)) {
      showError(t('setup.invalid'));
      return;
    }
    try {
      await upsertCustomerMix([
        { branchId, mixDate, customerType: mixType, count },
      ]);
      showSuccess(t('setup.mixSaved'));
      await load(true);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('setup.failed'));
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-destructive">{error}</p>
        <Button className="mt-4" onClick={() => void load(true)}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const branchOptions = data.activeBranches.length > 0 ? data.activeBranches : data.branchHealth.branches.map((b) => ({
    id: b.id,
    code: b.code,
    shortcode: b.shortcode,
    name: b.name,
  }));

  const maxTrend = Math.max(1, ...data.timeseries.map((p) => p.revenue));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          {data?.activeBranchCodes && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('activeBranches.count', { count: data.activeBranchCodes.length })}:{' '}
              {data.activeBranchCodes.join(', ')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSetup((v) => !v)}>
            <Target className="mr-2 h-4 w-4" />
            {t('setup.title')}
          </Button>
        </div>
      </div>

      {showSetup && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('setup.title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">
              <Label>{t('target.monthly')}</Label>
              <Input
                type="number"
                placeholder="5000000"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
              />
              <Button size="sm" onClick={() => void handleSaveTarget()} disabled={savingTarget}>
                {savingTarget ? <Loader2 className="h-4 w-4 animate-spin" /> : t('target.save')}
              </Button>
            </div>
            <div className="space-y-3">
              <Label>{t('setup.traffic')}</Label>
              <NativeSelect value={trafficBranchId} onChange={(e) => setTrafficBranchId(e.target.value)}>
                <option value="">{t('setup.selectBranch')}</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.shortcode || b.code} — {b.name} (ID {b.id})
                  </option>
                ))}
              </NativeSelect>
              <Input type="date" value={trafficDate} onChange={(e) => setTrafficDate(e.target.value)} />
              <Input placeholder={t('setup.footTraffic')} value={trafficFoot} onChange={(e) => setTrafficFoot(e.target.value)} />
              <Input placeholder={t('setup.transactions')} value={trafficTx} onChange={(e) => setTrafficTx(e.target.value)} />
              <Button size="sm" variant="secondary" onClick={() => void handleSaveTraffic()}>
                {t('setup.saveTraffic')}
              </Button>
            </div>
            <div className="space-y-3">
              <Label>{t('setup.customerMix')}</Label>
              <NativeSelect value={mixBranchId} onChange={(e) => setMixBranchId(e.target.value)}>
                <option value="">{t('setup.selectBranch')}</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.shortcode || b.code} — {b.name} (ID {b.id})
                  </option>
                ))}
              </NativeSelect>
              <Input type="date" value={mixDate} onChange={(e) => setMixDate(e.target.value)} />
              <Input placeholder={t('setup.customerType')} value={mixType} onChange={(e) => setMixType(e.target.value)} />
              <Input placeholder={t('setup.count')} value={mixCount} onChange={(e) => setMixCount(e.target.value)} />
              <Button size="sm" variant="secondary" onClick={() => void handleSaveMix()}>
                {t('setup.saveMix')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('kpi.yesterday')}</p>
            <p className="text-2xl font-bold">{baht(data.kpi.yesterday.revenue)}</p>
            <p className="text-xs text-muted-foreground">
              {data.kpi.yesterday.orders.toLocaleString('th-TH')} {t('kpi.bills')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('kpi.mtd')}</p>
            <p className="text-2xl font-bold">{baht(data.kpi.mtd.revenue)}</p>
            <p className={`text-xs ${data.kpi.revenueGrowthPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {pct(data.kpi.revenueGrowthPct)} vs {t('kpi.prevPeriod')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('kpi.gapToTarget')}</p>
            {data.kpi.targetConfigured && data.kpi.targetGap !== null ? (
              <>
                <p className={`text-2xl font-bold ${data.kpi.targetGap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {data.kpi.targetGap > 0 ? baht(data.kpi.targetGap) : t('kpi.onTrack')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('kpi.target')}: {baht(data.kpi.targetRevenue ?? 0)}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-muted-foreground">{t('kpi.noTarget')}</p>
                <p className="text-xs text-muted-foreground">{t('kpi.benchmarkMode')}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('kpi.avgBill')}</p>
            <p className="text-2xl font-bold">{baht(data.kpi.mtd.avgTicket)}</p>
            <p className="text-xs text-muted-foreground">{pct(data.kpi.avgTicketGrowthPct)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('kpi.transactions')}</p>
            <p className="text-2xl font-bold">{data.kpi.mtd.orders.toLocaleString('th-TH')}</p>
            <p className="text-xs text-muted-foreground">{pct(data.kpi.ordersGrowthPct)}</p>
          </CardContent>
        </Card>
      </div>

      {data.kpi.avgBillUpliftNeeded !== null && data.kpi.avgBillUpliftNeeded > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <Banknote className="h-5 w-5 text-amber-700" />
            <p className="text-sm">
              {t('uplift.message', {
                amount: Math.round(data.kpi.avgBillUpliftNeeded).toLocaleString('th-TH'),
                bills: data.kpi.expectedRemainingBills.toLocaleString('th-TH'),
              })}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              {t('branch.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-3 text-sm">
              <span className="text-emerald-700">{t('branch.green')}: {data.branchHealth.green}</span>
              <span className="text-amber-700">{t('branch.yellow')}: {data.branchHealth.yellow}</span>
              <span className="text-red-700">{t('branch.red')}: {data.branchHealth.red}</span>
            </div>
            {data.branchHealth.worstBranch && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                <span className="font-medium">{t('branch.worst')}: </span>
                {data.branchHealth.worstBranch.name} ({pct(data.branchHealth.worstBranch.revenueGrowthPct)})
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('branch.name')}</TableHead>
                    <TableHead className="text-right">{t('branch.revenue')}</TableHead>
                    <TableHead className="text-right">{t('branch.growth')}</TableHead>
                    <TableHead className="text-right">{t('kpi.bills')}</TableHead>
                    <TableHead className="text-right">{t('kpi.avgBill')}</TableHead>
                    <TableHead>{t('branch.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.branchHealth.branches.slice(0, 15).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <div>{b.name}</div>
                        <div className="text-xs text-muted-foreground">{b.shortcode || b.code}</div>
                      </TableCell>
                      <TableCell className="text-right">{baht(b.revenue)}</TableCell>
                      <TableCell className={`text-right ${b.revenueGrowthPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {pct(b.revenueGrowthPct)}
                      </TableCell>
                      <TableCell className="text-right">{b.orders.toLocaleString('th-TH')}</TableCell>
                      <TableCell className="text-right">{baht(b.avgTicket)}</TableCell>
                      <TableCell>{statusBadge(b.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              {t('diagnosis.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.diagnosis.map((d, i) => (
              <div key={i} className={`rounded-md border p-3 text-sm ${severityClass(d.severity)}`}>
                {d.message}
              </div>
            ))}
            {data.traffic.available && data.traffic.conversionPct !== null && (
              <div className="rounded-md border p-3 text-sm">
                <Users className="mb-1 inline h-4 w-4" /> {t('diagnosis.conversion')}: {data.traffic.conversionPct}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('trend.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-end gap-1">
            {data.timeseries.slice(-30).map((p) => (
              <div
                key={p.date}
                className="flex-1 rounded-t bg-primary/70"
                style={{ height: `${Math.max(4, (p.revenue / maxTrend) * 100)}%` }}
                title={`${p.date}: ${baht(p.revenue)}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('products.top')}</CardTitle>
            <Link href="/promotions">
              <Button size="sm" variant="outline">
                <Gift className="mr-1 h-4 w-4" /> {t('actions.planner')}
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('products.name')}</TableHead>
                  <TableHead className="text-right">{t('branch.revenue')}</TableHead>
                  <TableHead className="text-right">GP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topProducts.slice(0, 10).map((p) => (
                  <TableRow key={p.sku}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.sku}</div>
                    </TableCell>
                    <TableCell className="text-right">{baht(p.revenue)}</TableCell>
                    <TableCell className="text-right">{p.gpPct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('products.slow')}</CardTitle>
            <Link href="/promotions">
              <Button size="sm" variant="outline">
                <TrendingDown className="mr-1 h-4 w-4" /> {t('actions.clearance')}
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('products.name')}</TableHead>
                  <TableHead className="text-right">{t('products.qty')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slowMoving.slice(0, 10).map((p) => (
                  <TableRow key={p.sku}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.category}</div>
                    </TableCell>
                    <TableCell className="text-right">{p.qtySold}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('products.frontStore')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.frontStoreCandidates.slice(0, 12).map((p) => (
              <Link
                key={p.sku}
                href={`/content?sku=${encodeURIComponent(p.sku)}&product=${encodeURIComponent(p.name)}&price=${p.retailPrice}`}
              >
                <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                  {p.name.slice(0, 30)}
                  <ArrowRight className="ml-1 inline h-3 w-3" />
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">{t('billPromo.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{data.billNearPromo.message}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('actions.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/promotions">
            <Button>
              <Gift className="mr-2 h-4 w-4" />
              {t('actions.planner')}
            </Button>
          </Link>
          <Link href="/content">
            <Button variant="secondary">
              <Sparkles className="mr-2 h-4 w-4" />
              {t('actions.content')}
            </Button>
          </Link>
          <Link href="/posm">
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" />
              {t('actions.posm')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
