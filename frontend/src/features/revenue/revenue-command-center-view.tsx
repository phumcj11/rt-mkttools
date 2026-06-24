'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart2,
  Building2,
  CheckCircle2,
  ChevronRight,
  Footprints,
  Gift,
  Info,
  Loader2,
  Package,
  PackageX,
  Receipt,
  RefreshCw,
  Settings2,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
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

function pctText(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function GrowthChip({ value }: { value: number }) {
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600">
        <TrendingUp className="h-3 w-3" />
        {pctText(value)}
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600">
        <TrendingDown className="h-3 w-3" />
        {pctText(value)}
      </span>
    );
  return <span className="text-xs text-muted-foreground">—</span>;
}

function BranchStatusDot({ status }: { status: BranchHealthRow['status'] }) {
  if (status === 'green')
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" title="โต" />;
  if (status === 'yellow')
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" title="ทรงตัว" />;
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" title="ยอดตก" />;
}

function DiagnosisIcon({ severity }: { severity: string }) {
  if (severity === 'high')
    return <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />;
  if (severity === 'medium')
    return <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />;
  return <Info className="h-4 w-4 shrink-0 text-slate-500" />;
}

function severityClass(severity: string) {
  if (severity === 'high') return 'border-red-200 bg-red-50/60 text-red-900';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50/60 text-amber-900';
  return 'border-slate-200 bg-slate-50/60 text-slate-700';
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ElementType;
  accent?: string; // tailwind text- class for icon
  alert?: boolean;
}

function KpiCard({ label, value, sub, icon: Icon, accent = 'text-primary', alert }: KpiCardProps) {
  return (
    <Card className={alert ? 'border-red-200' : ''}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold leading-tight">{value}</p>
            {sub && <div className="mt-0.5">{sub}</div>}
          </div>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ${accent}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

type CompareMode = 'mom' | 'yoy' | 'both';

const COMPARE_OPTIONS: { id: CompareMode; label: string }[] = [
  { id: 'mom', label: 'vs เดือนก่อน' },
  { id: 'yoy', label: 'vs ปีที่แล้ว' },
  { id: 'both', label: 'ทั้งคู่' },
];

export function RevenueCommandCenterView() {
  const t = useTranslations('revenue');

  const [compareMode, setCompareMode] = useState<CompareMode>('mom');
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

  useEffect(() => { void load(); }, [load]);

  const handleSaveTarget = async () => {
    const amount = parseFloat(targetInput.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) { showError(t('target.invalid')); return; }
    setSavingTarget(true);
    try {
      await upsertSalesTargets([{ yearMonth, branchId: null, targetRevenue: amount }]);
      showSuccess(t('target.saved'));
      await load(true);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('target.failed'));
    } finally { setSavingTarget(false); }
  };

  const handleSaveTraffic = async () => {
    const branchId = parseInt(trafficBranchId, 10);
    const footTraffic = parseInt(trafficFoot, 10);
    if (!trafficDate || !Number.isFinite(branchId) || !Number.isFinite(footTraffic)) {
      showError(t('setup.invalid')); return;
    }
    try {
      await upsertTraffic([{ branchId, trafficDate, footTraffic, transactions: trafficTx ? parseInt(trafficTx, 10) : null }]);
      showSuccess(t('setup.trafficSaved'));
      await load(true);
    } catch (err) { showError(err instanceof ApiError ? err.message : t('setup.failed')); }
  };

  const handleSaveMix = async () => {
    const branchId = parseInt(mixBranchId, 10);
    const count = parseInt(mixCount, 10);
    if (!mixDate || !Number.isFinite(branchId) || !Number.isFinite(count)) {
      showError(t('setup.invalid')); return;
    }
    try {
      await upsertCustomerMix([{ branchId, mixDate, customerType: mixType, count }]);
      showSuccess(t('setup.mixSaved'));
      await load(true);
    } catch (err) { showError(err instanceof ApiError ? err.message : t('setup.failed')); }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm">กำลังโหลดข้อมูล ERP…</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-10 w-10 text-destructive/60" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => void load(true)}>
          <RefreshCw className="mr-2 h-4 w-4" /> {t('retry')}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const branchOptions = data.activeBranches.length > 0
    ? data.activeBranches
    : data.branchHealth.branches.map((b) => ({ id: b.id, code: b.code, shortcode: b.shortcode, name: b.name }));

  const maxTrend = Math.max(1, ...data.timeseries.map((p) => p.revenue));
  const trendDays = data.timeseries.slice(-30);
  const highDiagnosis = data.diagnosis.filter((d) => d.severity === 'high');

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BarChart2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">{t('title')}</h1>
            {data ? (
              <p className="text-xs text-muted-foreground">
                MTD {data.period.mtdFrom} → {data.period.mtdTo}
                {(compareMode === 'mom' || compareMode === 'both') && (
                  <span className="ml-2 text-muted-foreground/70">· MoM: {data.period.prevFrom} → {data.period.prevTo}</span>
                )}
                {(compareMode === 'yoy' || compareMode === 'both') && (
                  <span className="ml-2 text-amber-700">· YoY: {data.period.yoyFrom} → {data.period.yoyTo}</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Compare mode toggle */}
          <div className="flex overflow-hidden rounded-lg border text-xs font-medium">
            {COMPARE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setCompareMode(opt.id)}
                className={`px-3 py-1.5 transition-colors ${
                  compareMode === opt.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button variant="ghost" size="sm" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            <span className="ml-1.5 hidden sm:inline">{t('refresh')}</span>
          </Button>
          <Button
            variant={showSetup ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowSetup((v) => !v)}
          >
            <Settings2 className="h-4 w-4" />
            <span className="ml-1.5 hidden sm:inline">{t('setup.title')}</span>
          </Button>
        </div>
      </div>

      {/* ── High-severity alert banner ── */}
      {highDiagnosis.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/60 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="space-y-1">
            {highDiagnosis.map((d, i) => (
              <p key={i} className="text-sm font-medium text-red-900">{d.message}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Setup Panel ── */}
      {showSetup && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              {t('setup.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            {/* Target */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t('target.monthly')}</span>
              </div>
              <Input
                type="number"
                placeholder="5000000"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
              />
              <Button size="sm" className="w-full" onClick={() => void handleSaveTarget()} disabled={savingTarget}>
                {savingTarget ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-1.5 h-4 w-4" />{t('target.save')}</>}
              </Button>
            </div>

            {/* Traffic */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t('setup.traffic')}</span>
              </div>
              <NativeSelect value={trafficBranchId} onChange={(e) => setTrafficBranchId(e.target.value)}>
                <option value="">{t('setup.selectBranch')}</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.shortcode || b.code} — {b.name}
                  </option>
                ))}
              </NativeSelect>
              <Input type="date" value={trafficDate} onChange={(e) => setTrafficDate(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="คนเข้าร้าน" value={trafficFoot} onChange={(e) => setTrafficFoot(e.target.value)} />
                <Input placeholder="บิล (optional)" value={trafficTx} onChange={(e) => setTrafficTx(e.target.value)} />
              </div>
              <Button size="sm" variant="secondary" className="w-full" onClick={() => void handleSaveTraffic()}>
                <Footprints className="mr-1.5 h-4 w-4" />{t('setup.saveTraffic')}
              </Button>
            </div>

            {/* Customer Mix */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t('setup.customerMix')}</span>
              </div>
              <NativeSelect value={mixBranchId} onChange={(e) => setMixBranchId(e.target.value)}>
                <option value="">{t('setup.selectBranch')}</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.shortcode || b.code} — {b.name}
                  </option>
                ))}
              </NativeSelect>
              <Input type="date" value={mixDate} onChange={(e) => setMixDate(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="family / solo / tourist" value={mixType} onChange={(e) => setMixType(e.target.value)} />
                <Input placeholder="จำนวน" value={mixCount} onChange={(e) => setMixCount(e.target.value)} />
              </div>
              <Button size="sm" variant="secondary" className="w-full" onClick={() => void handleSaveMix()}>
                <Users className="mr-1.5 h-4 w-4" />{t('setup.saveMix')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Row ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label={t('kpi.yesterday')}
          value={baht(data.kpi.yesterday.revenue)}
          sub={<span className="text-xs text-muted-foreground">{data.kpi.yesterday.orders.toLocaleString('th-TH')} {t('kpi.bills')}</span>}
          icon={Receipt}
          accent="text-slate-600"
        />
        <KpiCard
          label={t('kpi.mtd')}
          value={baht(data.kpi.mtd.revenue)}
          sub={
            <div className="space-y-0.5">
              {(compareMode === 'mom' || compareMode === 'both') && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">MoM</span>
                  <GrowthChip value={data.kpi.revenueGrowthPct} />
                </div>
              )}
              {(compareMode === 'yoy' || compareMode === 'both') && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">YoY</span>
                  <GrowthChip value={data.kpi.yoyRevenueGrowthPct} />
                </div>
              )}
            </div>
          }
          icon={TrendingUp}
          accent={
            (compareMode === 'yoy' ? data.kpi.yoyRevenueGrowthPct : data.kpi.revenueGrowthPct) >= 0
              ? 'text-emerald-600'
              : 'text-red-600'
          }
        />
        <KpiCard
          label={t('kpi.gapToTarget')}
          value={
            data.kpi.targetConfigured && data.kpi.targetGap !== null
              ? data.kpi.targetGap > 0
                ? baht(data.kpi.targetGap)
                : t('kpi.onTrack')
              : t('kpi.noTarget')
          }
          sub={
            data.kpi.targetConfigured && data.kpi.targetRevenue
              ? <span className="text-xs text-muted-foreground">{t('kpi.target')}: {baht(data.kpi.targetRevenue)}</span>
              : <span className="text-xs text-muted-foreground">{t('kpi.benchmarkMode')}</span>
          }
          icon={Target}
          accent={!data.kpi.targetConfigured ? 'text-slate-400' : data.kpi.targetGap !== null && data.kpi.targetGap > 0 ? 'text-red-600' : 'text-emerald-600'}
          alert={data.kpi.targetGap !== null && data.kpi.targetGap > 0}
        />
        <KpiCard
          label={t('kpi.avgBill')}
          value={baht(data.kpi.mtd.avgTicket)}
          sub={
            <div className="space-y-0.5">
              {(compareMode === 'mom' || compareMode === 'both') && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">MoM</span>
                  <GrowthChip value={data.kpi.avgTicketGrowthPct} />
                </div>
              )}
              {(compareMode === 'yoy' || compareMode === 'both') && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">YoY</span>
                  <GrowthChip value={data.kpi.yoyAvgTicketGrowthPct} />
                </div>
              )}
            </div>
          }
          icon={Wallet}
          accent="text-primary"
        />
        <KpiCard
          label={t('kpi.transactions')}
          value={data.kpi.mtd.orders.toLocaleString('th-TH')}
          sub={
            <div className="space-y-0.5">
              {(compareMode === 'mom' || compareMode === 'both') && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">MoM</span>
                  <GrowthChip value={data.kpi.ordersGrowthPct} />
                </div>
              )}
              {(compareMode === 'yoy' || compareMode === 'both') && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">YoY</span>
                  <GrowthChip value={data.kpi.yoyOrdersGrowthPct} />
                </div>
              )}
            </div>
          }
          icon={ShoppingCart}
          accent="text-slate-600"
        />
      </div>

      {/* ── Bill Uplift Banner ── */}
      {data.kpi.avgBillUpliftNeeded !== null && data.kpi.avgBillUpliftNeeded > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
          <Banknote className="h-5 w-5 shrink-0 text-amber-700" />
          <p className="text-sm text-amber-900">
            {t('uplift.message', {
              amount: Math.round(data.kpi.avgBillUpliftNeeded).toLocaleString('th-TH'),
              bills: data.kpi.expectedRemainingBills.toLocaleString('th-TH'),
            })}
          </p>
        </div>
      )}

      {/* ── Branch Health + Diagnosis ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Branch board */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {t('branch.title')}
              </CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {t('branch.green')} <strong>{data.branchHealth.green}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {t('branch.yellow')} <strong>{data.branchHealth.yellow}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {t('branch.red')} <strong>{data.branchHealth.red}</strong>
                </span>
              </div>
            </div>
            {data.branchHealth.worstBranch && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-red-900">
                  <strong>{t('branch.worst')}:</strong>{' '}
                  {data.branchHealth.worstBranch.shortcode || data.branchHealth.worstBranch.code} — {data.branchHealth.worstBranch.name}
                  <span className="ml-2 font-medium text-red-700">
                    MoM {pctText(data.branchHealth.worstBranch.revenueGrowthPct)}
                    {compareMode !== 'mom' && (
                      <span className="ml-1 text-red-600">
                        · YoY {pctText(data.branchHealth.worstBranch.yoyRevenueGrowthPct)}
                      </span>
                    )}
                  </span>
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>{t('branch.name')}</TableHead>
                    <TableHead className="text-right">{t('branch.revenue')}</TableHead>
                    {(compareMode === 'mom' || compareMode === 'both') && (
                      <TableHead className="text-right text-xs">
                        <span className="text-muted-foreground">MoM</span>
                      </TableHead>
                    )}
                    {(compareMode === 'yoy' || compareMode === 'both') && (
                      <TableHead className="text-right text-xs">
                        <span className="text-amber-700">YoY</span>
                      </TableHead>
                    )}
                    <TableHead className="text-right">{t('kpi.avgBill')}</TableHead>
                    <TableHead className="text-right">{t('kpi.bills')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.branchHealth.branches.slice(0, 18).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <BranchStatusDot status={b.status} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium leading-tight">{b.name}</div>
                        <div className="text-[11px] text-muted-foreground">{b.shortcode || b.code}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{baht(b.revenue)}</TableCell>
                      {(compareMode === 'mom' || compareMode === 'both') && (
                        <TableCell className="text-right">
                          <GrowthChip value={b.revenueGrowthPct} />
                        </TableCell>
                      )}
                      {(compareMode === 'yoy' || compareMode === 'both') && (
                        <TableCell className="text-right">
                          <GrowthChip value={b.yoyRevenueGrowthPct} />
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">{baht(b.avgTicket)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {b.orders.toLocaleString('th-TH')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Diagnosis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              {t('diagnosis.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.diagnosis.map((d, i) => (
              <div key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${severityClass(d.severity)}`}>
                <DiagnosisIcon severity={d.severity} />
                <span className="leading-snug">{d.message}</span>
              </div>
            ))}
            {data.traffic.available && data.traffic.conversionPct !== null && (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm">
                <Users className="h-4 w-4 shrink-0 text-primary" />
                <span>{t('diagnosis.conversion')}: <strong>{data.traffic.conversionPct}%</strong></span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Trend Chart ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            {t('trend.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-28 items-end gap-0.5">
            {trendDays.map((p, i) => {
              const h = Math.max(3, (p.revenue / maxTrend) * 100);
              const isLast = i === trendDays.length - 1;
              return (
                <div
                  key={p.date}
                  className={`group relative flex-1 rounded-t transition-colors ${isLast ? 'bg-primary' : 'bg-primary/30 hover:bg-primary/60'}`}
                  style={{ height: `${h}%` }}
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
                    {p.date.slice(5)}: {baht(p.revenue)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{trendDays[0]?.date.slice(5)}</span>
            <span>{trendDays[Math.floor(trendDays.length / 2)]?.date.slice(5)}</span>
            <span>{trendDays[trendDays.length - 1]?.date.slice(5)}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Products: Top + Slow Moving ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                {t('products.top')}
              </CardTitle>
              <Link href="/promotions">
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                  <Gift className="h-3.5 w-3.5" />
                  {t('actions.planner')}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.topProducts.slice(0, 8).map((p, i) => (
                <div key={p.sku} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                  <span className="w-5 text-right text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium leading-tight">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{baht(p.revenue)}</div>
                    <div className="text-[11px] text-muted-foreground">GP {p.gpPct.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <PackageX className="h-4 w-4 text-muted-foreground" />
                {t('products.slow')}
              </CardTitle>
              <Link href="/promotions">
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {t('actions.clearance')}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.slowMoving.slice(0, 8).map((p) => (
                <div key={p.sku} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium leading-tight">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.category}</div>
                  </div>
                  <Badge variant={p.qtySold === 0 ? 'destructive' : 'secondary'} className="text-xs tabular-nums">
                    {p.qtySold} ชิ้น
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Front Store Candidates ── */}
      {data.frontStoreCandidates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-muted-foreground" />
              {t('products.frontStore')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.frontStoreCandidates.slice(0, 12).map((p) => (
                <Link
                  key={p.sku}
                  href={`/content?sku=${encodeURIComponent(p.sku)}&product=${encodeURIComponent(p.name)}&price=${p.retailPrice}`}
                >
                  <div className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
                    <span className="max-w-[160px] truncate">{p.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Action Shortcuts ── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('actions.title')}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/promotions" className="block">
            <div className="group flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary-foreground/20">
                <Gift className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
              </span>
              <div>
                <div className="font-semibold text-sm">{t('actions.planner')}</div>
                <div className="text-xs text-muted-foreground group-hover:text-primary-foreground/70">วาง promo จากสินค้า ERP</div>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 opacity-40 group-hover:opacity-100" />
            </div>
          </Link>
          <Link href="/content" className="block">
            <div className="group flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary-foreground/20">
                <Sparkles className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
              </span>
              <div>
                <div className="font-semibold text-sm">{t('actions.content')}</div>
                <div className="text-xs text-muted-foreground group-hover:text-primary-foreground/70">สร้าง caption / โพสต์ AI</div>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 opacity-40 group-hover:opacity-100" />
            </div>
          </Link>
          <Link href="/posm" className="block">
            <div className="group flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary-foreground/20">
                <TrendingUp className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
              </span>
              <div>
                <div className="font-semibold text-sm">{t('actions.posm')}</div>
                <div className="text-xs text-muted-foreground group-hover:text-primary-foreground/70">ทำสื่อหน้าร้าน</div>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 opacity-40 group-hover:opacity-100" />
            </div>
          </Link>
        </div>
      </div>

      {/* ── Bill Near Promo placeholder ── */}
      <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-muted-foreground">
        <Banknote className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider">{t('billPromo.title')}</p>
          <p className="mt-1 text-xs">{data.billNearPromo.message}</p>
        </div>
      </div>

    </div>
  );
}
