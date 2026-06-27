'use client';

import { useMemo, useState } from 'react';
import { Building2, Sparkles, TrendingDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { BranchHealthRow, BranchMarketingStatus, BranchRootCause } from '@/lib/revenue-api';
import { baht, BranchStatusDot, CompareRow, GrowthChip } from './revenue-shared';
import type { CompareMode } from './revenue-constants';
import { RankBadge, SectionCard } from './revenue-ui';
import { BranchAiAnalysisDrawer } from './branch-ai-analysis-drawer';
import { cn } from '@/lib/utils';

interface BranchHealthCardGridProps {
  branches: BranchHealthRow[];
  compareMode: CompareMode;
}

const statusBorder: Record<BranchHealthRow['status'], string> = {
  green: 'border-emerald-200 hover:border-emerald-300',
  yellow: 'border-amber-200 hover:border-amber-300',
  red: 'border-red-200 hover:border-red-300',
};

const statusBg: Record<BranchHealthRow['status'], string> = {
  green: 'from-emerald-50/80 to-white',
  yellow: 'from-amber-50/80 to-white',
  red: 'from-red-50/80 to-white',
};

const aiBtnCls: Record<BranchHealthRow['status'], string> = {
  red: 'bg-rose-600 hover:bg-rose-700 text-white',
  yellow: 'bg-amber-500 hover:bg-amber-600 text-amber-950',
  green: 'bg-emerald-600 hover:bg-emerald-700 text-white',
};

function MiniMoMBars({ prev, current, status }: { prev: number; current: number; status: BranchHealthRow['status'] }) {
  const max = Math.max(prev, current, 1);
  const currentBarCls =
    status === 'red' ? 'bg-rose-500' : status === 'yellow' ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="mt-2 flex h-11 items-end gap-2 rounded-lg border border-black/5 bg-white/50 px-2 py-1.5">
      <div className="flex flex-1 flex-col items-center justify-end gap-0.5">
        <div
          className="w-full min-h-[4px] rounded-t bg-slate-300/90"
          style={{ height: `${Math.max(6, (prev / max) * 28)}px` }}
          title={baht(prev)}
        />
        <span className="text-[9px] font-medium text-muted-foreground">MoM</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-end gap-0.5">
        <div
          className={cn('w-full min-h-[4px] rounded-t', currentBarCls)}
          style={{ height: `${Math.max(6, (current / max) * 28)}px` }}
          title={baht(current)}
        />
        <span className="text-[9px] font-medium text-muted-foreground">MTD</span>
      </div>
    </div>
  );
}

function compactBaht(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${Math.round(n / 1_000)}K`;
  return baht(n);
}

const statusLabel: Record<BranchMarketingStatus, string> = {
  critical: 'วิกฤต',
  watch: 'เฝ้าระวัง',
  recovering: 'ฟื้นตัว',
  aboveTarget: 'ดีเกินเป้า',
  billDrop: 'บิลตก',
  avgDrop: 'Avg ตก',
  healthy: 'ปกติ',
};

const rootCauseLabel: Record<BranchRootCause, string> = {
  traffic: 'Traffic ลด',
  upsell: 'Upsell/Bundle',
  trafficAndUpsell: 'บิลลด + Avg ลด',
  smallBasket: 'บิลเล็ก',
  targetRisk: 'เสี่ยงไม่ถึงเป้า',
  healthy: 'รักษาโมเมนตัม',
};

const marketingStatusCls: Record<BranchMarketingStatus, string> = {
  critical: 'border-red-200 bg-red-100 text-red-800',
  watch: 'border-amber-200 bg-amber-100 text-amber-900',
  recovering: 'border-blue-200 bg-blue-100 text-blue-800',
  aboveTarget: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  billDrop: 'border-orange-200 bg-orange-100 text-orange-800',
  avgDrop: 'border-pink-200 bg-pink-100 text-pink-800',
  healthy: 'border-slate-200 bg-slate-100 text-slate-700',
};

export function BranchHealthCardGrid({ branches, compareMode }: BranchHealthCardGridProps) {
  const t = useTranslations('revenue');
  const [selectedBranch, setSelectedBranch] = useState<BranchHealthRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sorted = useMemo(
    () => [...branches].sort((a, b) => b.concernScore - a.concernScore || b.revenue - a.revenue),
    [branches],
  );

  const showMom = compareMode === 'mom' || compareMode === 'both';
  const showYoy = compareMode === 'yoy' || compareMode === 'both';

  const openAnalysis = (branch: BranchHealthRow) => {
    setSelectedBranch(branch);
    setDrawerOpen(true);
  };

  return (
    <>
      <SectionCard
        tone="violet"
        icon={Building2}
        title={t('branchCards.title')}
        subtitle={t('branchCards.subtitle')}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {sorted.map((b, idx) => (
            <article
              key={b.id}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-gradient-to-br p-4 shadow-sm transition-shadow hover:shadow-md',
                statusBorder[b.status],
                statusBg[b.status],
              )}
            >
              <div className="absolute right-3 top-3">
                <RankBadge rank={idx + 1} />
              </div>

              <div className="flex items-start justify-between gap-2 pr-8">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold leading-tight">
                    {b.shortcode || b.code}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{b.name}</p>
                </div>
                <BranchStatusDot status={b.status} />
              </div>

              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">{t('kpi.mtd')}</p>
                <p className="text-2xl font-bold tabular-nums leading-tight sm:text-3xl">
                  {baht(b.revenue)}
                </p>
              </div>

              <MiniMoMBars prev={b.prevRevenue} current={b.revenue} status={b.status} />

              {(b.targetAchievementPct !== null && b.targetAchievementPct !== undefined) && (
                <div className="mt-3 rounded-lg border border-black/5 bg-white/70 px-2.5 py-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-medium text-muted-foreground">{t('branchCards.target')}</span>
                    <span className="font-bold tabular-nums text-violet-700">{b.targetAchievementPct.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        b.targetAchievementPct >= 100 ? 'bg-emerald-500' : b.targetAchievementPct >= 70 ? 'bg-amber-500' : 'bg-red-500',
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, b.targetAchievementPct))}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{t('branchCards.forecast')} {compactBaht(b.forecastRevenue)}</span>
                    {b.dailyGapToTarget !== null && b.dailyGapToTarget !== undefined && b.dailyGapToTarget > 0 && (
                      <span className="font-semibold text-red-600">{compactBaht(b.dailyGapToTarget)}/{t('branchCards.day')}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-black/5 bg-white/70 px-2.5 py-2 shadow-sm">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('kpi.bills')}</p>
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-semibold tabular-nums">{b.orders.toLocaleString('th-TH')}</p>
                    <GrowthChip value={b.ordersGrowthPct} />
                  </div>
                </div>
                <div className="rounded-lg border border-black/5 bg-white/70 px-2.5 py-2 shadow-sm">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('kpi.avgBill')}</p>
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-semibold tabular-nums">{baht(b.avgTicket)}</p>
                    <GrowthChip value={b.avgTicketGrowthPct} />
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {b.marketingStatus && (
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', marketingStatusCls[b.marketingStatus])}>
                    {statusLabel[b.marketingStatus]}
                  </span>
                )}
                {b.rootCause && (
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                    {rootCauseLabel[b.rootCause]}
                  </span>
                )}
              </div>

              {!!b.campaignBills && b.campaignBills > 0 && (
                <p className="mt-2 text-[11px] font-medium text-emerald-700">
                  {t('branchCards.campaignBills')}: {b.campaignBills.toLocaleString('th-TH')}
                  {b.campaignConversionPct !== null && b.campaignConversionPct !== undefined ? ` (${b.campaignConversionPct.toFixed(1)}%)` : ''}
                </p>
              )}

              {(showMom || showYoy) && (
                <div className="mt-2 space-y-0.5 border-t border-black/5 pt-2">
                  {showMom && (
                    <CompareRow
                      label="MoM"
                      prevValue={b.prevRevenue}
                      pct={b.revenueGrowthPct}
                    />
                  )}
                  {showYoy && (
                    <CompareRow
                      label="YoY"
                      prevValue={b.yoyRevenue}
                      pct={b.yoyRevenueGrowthPct}
                      labelClass="text-amber-700"
                      unavailable={!b.yoyReliable}
                    />
                  )}
                </div>
              )}

              {b.status === 'red' && (
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-700">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {t('branchCards.decliningHint')}
                </p>
              )}

              <Button
                size="sm"
                className={cn('mt-3 w-full', aiBtnCls[b.status])}
                onClick={() => openAnalysis(b)}
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                {t('branchCards.analyze')}
              </Button>
            </article>
          ))}
        </div>
      </SectionCard>

      <BranchAiAnalysisDrawer
        branch={selectedBranch}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
