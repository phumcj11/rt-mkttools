'use client';

import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  BarChart2,
  CheckCircle2,
  Footprints,
  Loader2,
  Receipt,
  Settings2,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { CommandCenterData } from '@/lib/revenue-api';
import { baht, CompareRow, DiagnosisIcon, KpiCard, severityClass } from '../revenue-shared';
import type { CompareMode } from '../revenue-constants';
import { IconBox, SectionCard, TabHero } from '../revenue-ui';
import { BranchHealthCardGrid } from '../branch-health-card-grid';
import { PosImportPanel } from '../pos-import-panel';

interface OverviewTabProps {
  data: CommandCenterData;
  compareMode: CompareMode;
  showSetup: boolean;
  targetInput: string;
  savingTarget: boolean;
  trafficBranchId: string;
  trafficDate: string;
  trafficFoot: string;
  trafficTx: string;
  mixBranchId: string;
  mixDate: string;
  mixType: string;
  mixCount: string;
  branchOptions: Array<{ id: number; code: string; shortcode: string; name: string }>;
  onTargetInput: (v: string) => void;
  onSaveTarget: () => void;
  onTrafficBranchId: (v: string) => void;
  onTrafficDate: (v: string) => void;
  onTrafficFoot: (v: string) => void;
  onTrafficTx: (v: string) => void;
  onMixBranchId: (v: string) => void;
  onMixDate: (v: string) => void;
  onMixType: (v: string) => void;
  onMixCount: (v: string) => void;
  onSaveTraffic: () => void;
  onSaveMix: () => void;
  onPosSynced?: () => void;
}

export function OverviewTab({
  data,
  compareMode,
  showSetup,
  targetInput,
  savingTarget,
  trafficBranchId,
  trafficDate,
  trafficFoot,
  trafficTx,
  mixBranchId,
  mixDate,
  mixType,
  mixCount,
  branchOptions,
  onTargetInput,
  onSaveTarget,
  onTrafficBranchId,
  onTrafficDate,
  onTrafficFoot,
  onTrafficTx,
  onMixBranchId,
  onMixDate,
  onMixType,
  onMixCount,
  onSaveTraffic,
  onSaveMix,
  onPosSynced,
}: OverviewTabProps) {
  const t = useTranslations('revenue');
  const maxTrend = Math.max(1, ...data.timeseries.map((p) => p.revenue));
  const trendDays = data.timeseries.slice(-30);
  const highDiagnosis = data.diagnosis.filter((d) => d.severity === 'high');

  return (
    <div className="space-y-5">
      <TabHero tabId="overview" title={t('tabs.overview')} subtitle={t('tabHero.overview')} />
      {(compareMode === 'yoy' || compareMode === 'both') && !data.kpi.yoyReliable && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">ข้อมูลเทียบปีที่แล้วอาจไม่ครบ</p>
            <p className="mt-0.5 text-xs">
              {data.kpi.yoyMessage || 'ERP อาจไม่คืนยอดย้อนหลังครบ 1 ปี — ลอง sync ยอดขายรายวันใน ERP หรือใช้ MoM แทน'}
            </p>
          </div>
        </div>
      )}

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

      {showSetup && (
        <Card className="overflow-hidden border-violet-200 shadow-sm">
          <CardHeader className="border-b bg-violet-50/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <IconBox icon={Settings2} tone="violet" size="sm" />
              {t('setup.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 pt-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-medium">{t('target.monthly')}</span>
              </div>
              <Input type="number" placeholder="5000000" value={targetInput} onChange={(e) => onTargetInput(e.target.value)} />
              <Button size="sm" className="w-full" onClick={onSaveTarget} disabled={savingTarget}>
                {savingTarget ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-1.5 h-4 w-4" />{t('target.save')}</>}
              </Button>
            </div>
            <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-cyan-600" />
                <span className="text-sm font-medium">{t('setup.traffic')}</span>
              </div>
              <NativeSelect value={trafficBranchId} onChange={(e) => onTrafficBranchId(e.target.value)}>
                <option value="">{t('setup.selectBranch')}</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={String(b.id)}>{b.shortcode || b.code} — {b.name}</option>
                ))}
              </NativeSelect>
              <Input type="date" value={trafficDate} onChange={(e) => onTrafficDate(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="คนเข้าร้าน" value={trafficFoot} onChange={(e) => onTrafficFoot(e.target.value)} />
                <Input placeholder="บิล (optional)" value={trafficTx} onChange={(e) => onTrafficTx(e.target.value)} />
              </div>
              <Button size="sm" variant="secondary" className="w-full" onClick={onSaveTraffic}>
                <Footprints className="mr-1.5 h-4 w-4" />{t('setup.saveTraffic')}
              </Button>
            </div>
            <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-medium">{t('setup.customerMix')}</span>
              </div>
              <NativeSelect value={mixBranchId} onChange={(e) => onMixBranchId(e.target.value)}>
                <option value="">{t('setup.selectBranch')}</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={String(b.id)}>{b.shortcode || b.code} — {b.name}</option>
                ))}
              </NativeSelect>
              <Input type="date" value={mixDate} onChange={(e) => onMixDate(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="family / solo / tourist" value={mixType} onChange={(e) => onMixType(e.target.value)} />
                <Input placeholder="จำนวน" value={mixCount} onChange={(e) => onMixCount(e.target.value)} />
              </div>
              <Button size="sm" variant="secondary" className="w-full" onClick={onSaveMix}>
                <Users className="mr-1.5 h-4 w-4" />{t('setup.saveMix')}
              </Button>
            </div>
            <PosImportPanel active={showSetup} onSynced={onPosSynced} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard tone="blue" label={t('kpi.yesterday')} value={baht(data.kpi.yesterday.revenue)} sub={<span className="text-xs text-muted-foreground">{data.kpi.yesterday.orders.toLocaleString('th-TH')} {t('kpi.bills')}</span>} icon={Receipt} />
        <KpiCard
          tone="emerald"
          label={t('kpi.mtd')}
          value={baht(data.kpi.mtd.revenue)}
          sub={
            <div className="mt-0.5 space-y-0.5">
              {(compareMode === 'mom' || compareMode === 'both') && (
                <CompareRow label="MoM" prevValue={data.kpi.prevPeriod.revenue} pct={data.kpi.revenueGrowthPct} />
              )}
              {(compareMode === 'yoy' || compareMode === 'both') && (
                <CompareRow label="YoY" prevValue={data.kpi.yoyPeriod.revenue} pct={data.kpi.yoyRevenueGrowthPct} labelClass="text-amber-700" unavailable={!data.kpi.yoyReliable} />
              )}
            </div>
          }
          icon={TrendingUp}
        />
        <KpiCard
          tone="violet"
          label={t('kpi.gapToTarget')}
          value={data.kpi.targetConfigured && data.kpi.targetGap !== null ? (data.kpi.targetGap > 0 ? baht(data.kpi.targetGap) : t('kpi.onTrack')) : t('kpi.noTarget')}
          sub={data.kpi.targetConfigured && data.kpi.targetRevenue ? <span className="text-xs text-muted-foreground">{t('kpi.target')}: {baht(data.kpi.targetRevenue)}</span> : <span className="text-xs text-muted-foreground">{t('kpi.benchmarkMode')}</span>}
          icon={Target}
          alert={data.kpi.targetGap !== null && data.kpi.targetGap > 0}
        />
        <KpiCard
          tone="cyan"
          label={t('kpi.avgBill')}
          value={baht(data.kpi.mtd.avgTicket)}
          sub={
            <div className="mt-0.5 space-y-0.5">
              {(compareMode === 'mom' || compareMode === 'both') && <CompareRow label="MoM" prevValue={data.kpi.prevPeriod.avgTicket} pct={data.kpi.avgTicketGrowthPct} />}
              {(compareMode === 'yoy' || compareMode === 'both') && <CompareRow label="YoY" prevValue={data.kpi.yoyPeriod.avgTicket} pct={data.kpi.yoyAvgTicketGrowthPct} labelClass="text-amber-700" unavailable={!data.kpi.yoyReliable} />}
            </div>
          }
          icon={Wallet}
        />
        <KpiCard
          tone="orange"
          label={t('kpi.transactions')}
          value={data.kpi.mtd.orders.toLocaleString('th-TH')}
          sub={
            <div className="mt-0.5 space-y-0.5">
              {(compareMode === 'mom' || compareMode === 'both') && <CompareRow label="MoM" prevValue={data.kpi.prevPeriod.orders} pct={data.kpi.ordersGrowthPct} formatFn={(v) => v.toLocaleString('th-TH')} />}
              {(compareMode === 'yoy' || compareMode === 'both') && <CompareRow label="YoY" prevValue={data.kpi.yoyPeriod.orders} pct={data.kpi.yoyOrdersGrowthPct} formatFn={(v) => v.toLocaleString('th-TH')} labelClass="text-amber-700" unavailable={!data.kpi.yoyReliable} />}
            </div>
          }
          icon={ShoppingCart}
        />
      </div>

      <BranchHealthCardGrid branches={data.branchHealth.branches} compareMode={compareMode} />

      {data.kpi.avgBillUpliftNeeded !== null && data.kpi.avgBillUpliftNeeded > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
            <Banknote className="h-5 w-5" />
          </span>
          <p className="text-sm text-amber-900">
            {t('uplift.message', { amount: Math.round(data.kpi.avgBillUpliftNeeded).toLocaleString('th-TH'), bills: data.kpi.expectedRemainingBills.toLocaleString('th-TH') })}
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard tone="violet" icon={AlertCircle} title={t('diagnosis.title')} subtitle={t('tabHero.diagnosis')} className="lg:col-span-2">
          <div className="space-y-2">
            {data.diagnosis.map((d, i) => (
              <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${severityClass(d.severity)}`}>
                <DiagnosisIcon severity={d.severity} />
                <span className="leading-snug">{d.message}</span>
              </div>
            ))}
            {data.traffic.available && data.traffic.conversionPct !== null && (
              <div className="flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50/50 px-3 py-2.5 text-sm">
                <Users className="h-4 w-4 shrink-0 text-cyan-600" />
                <span>{t('diagnosis.conversion')}: <strong>{data.traffic.conversionPct}%</strong></span>
              </div>
            )}
          </div>
        </SectionCard>
        <SectionCard tone="blue" icon={BarChart2} title={t('trend.title')} subtitle={t('tabHero.trend')}>
          <div className="flex h-32 items-end gap-1">
            {trendDays.map((p, i) => {
              const h = Math.max(3, (p.revenue / maxTrend) * 100);
              const isLast = i === trendDays.length - 1;
              return (
                <div
                  key={p.date}
                  className={`group relative flex-1 rounded-t-md transition-all ${isLast ? 'bg-gradient-to-t from-blue-600 to-cyan-400' : 'bg-blue-200/70 hover:bg-blue-400/80'}`}
                  style={{ height: `${h}%` }}
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
                    {p.date.slice(5)}: {baht(p.revenue)}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
