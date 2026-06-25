'use client';

import { useMemo, useState } from 'react';
import { Building2, Sparkles, TrendingDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { BranchHealthRow } from '@/lib/revenue-api';
import { baht, BranchStatusDot, CompareRow } from './revenue-shared';
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

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-black/5 bg-white/70 px-2.5 py-2 shadow-sm">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('kpi.bills')}</p>
                  <p className="font-semibold tabular-nums">{b.orders.toLocaleString('th-TH')}</p>
                </div>
                <div className="rounded-lg border border-black/5 bg-white/70 px-2.5 py-2 shadow-sm">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('kpi.avgBill')}</p>
                  <p className="font-semibold tabular-nums">{baht(b.avgTicket)}</p>
                </div>
              </div>

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
