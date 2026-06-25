'use client';

import { AlertTriangle, Building2, Loader2, Store, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { BranchDailySalesData, CommandCenterData } from '@/lib/revenue-api';
import { BranchHealthTable } from '../branch-health-table';
import { BranchDailySalesChart } from '../branch-daily-sales-chart';
import { pctText } from '../revenue-shared';
import type { BranchChartPreset, CompareMode } from '../revenue-constants';
import { BRANCH_CHART_RANGE_OPTIONS } from '../revenue-constants';
import { ChipToggleGroup, ComparePeriodBar, SectionCard, StatTile, TabHero } from '../revenue-ui';

interface BranchSalesTabProps {
  data: CommandCenterData;
  compareMode: CompareMode;
  branchChartData: BranchDailySalesData | null;
  branchChartLoading: boolean;
  branchChartError: string | null;
  branchChartPreset: BranchChartPreset;
  onBranchChartPreset: (preset: BranchChartPreset) => void;
}

export function BranchSalesTab({
  data,
  compareMode,
  branchChartData,
  branchChartLoading,
  branchChartError,
  branchChartPreset,
  onBranchChartPreset,
}: BranchSalesTabProps) {
  const t = useTranslations('revenue');

  return (
    <div className="space-y-5">
      <TabHero tabId="branch-sales" title={t('tabs.branchSales')} subtitle={t('tabHero.branchSales')} />
      <ComparePeriodBar compareMode={compareMode} period={data.period} />
      <div className="grid grid-cols-3 gap-3">
        <StatTile tone="emerald" icon={TrendingUp} label={t('branch.green')} value={data.branchHealth.green} valueClassName="text-emerald-600" />
        <StatTile tone="amber" icon={Building2} label={t('branch.yellow')} value={data.branchHealth.yellow} valueClassName="text-amber-600" />
        <StatTile tone="rose" icon={AlertTriangle} label={t('branch.red')} value={data.branchHealth.red} valueClassName="text-red-600" />
      </div>

      {data.branchHealth.worstBranch && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <span>
            <strong>{t('branch.worst')}:</strong>{' '}
            {data.branchHealth.worstBranch.shortcode || data.branchHealth.worstBranch.code} — {data.branchHealth.worstBranch.name}
            <span className="ml-2 font-semibold text-red-700">MoM {pctText(data.branchHealth.worstBranch.revenueGrowthPct)}</span>
          </span>
        </div>
      )}

      <SectionCard tone="blue" icon={Building2} title={t('branch.title')} subtitle={t('tabHero.branchTable')}>
        <BranchHealthTable branches={data.branchHealth.branches} compareMode={compareMode} />
      </SectionCard>

      <SectionCard
        tone="cyan"
        icon={Store}
        title={t('branchChart.title')}
        subtitle={t('branchChart.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <ChipToggleGroup options={BRANCH_CHART_RANGE_OPTIONS} value={branchChartPreset} onChange={onBranchChartPreset} tone="cyan" />
            {branchChartLoading && <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />}
          </div>
        }
      >
        {branchChartError && <p className="mb-3 text-sm text-destructive">{branchChartError}</p>}
        <BranchDailySalesChart data={branchChartData} loading={branchChartLoading} />
      </SectionCard>
    </div>
  );
}
