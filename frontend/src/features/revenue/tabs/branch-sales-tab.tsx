'use client';

import { AlertTriangle, Building2, Loader2, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BranchDailySalesData, CommandCenterData } from '@/lib/revenue-api';
import { BranchHealthTable } from '../branch-health-table';
import { BranchDailySalesChart } from '../branch-daily-sales-chart';
import { pctText } from '../revenue-shared';
import type { BranchChartPreset, CompareMode } from '../revenue-constants';
import { BRANCH_CHART_RANGE_OPTIONS } from '../revenue-constants';

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
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {t('branch.title')}
            </CardTitle>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('branch.green')} <strong>{data.branchHealth.green}</strong></span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />{t('branch.yellow')} <strong>{data.branchHealth.yellow}</strong></span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />{t('branch.red')} <strong>{data.branchHealth.red}</strong></span>
            </div>
          </div>
          {data.branchHealth.worstBranch && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-red-900">
                <strong>{t('branch.worst')}:</strong>{' '}
                {data.branchHealth.worstBranch.shortcode || data.branchHealth.worstBranch.code} — {data.branchHealth.worstBranch.name}
                <span className="ml-2 font-medium text-red-700">MoM {pctText(data.branchHealth.worstBranch.revenueGrowthPct)}</span>
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <BranchHealthTable branches={data.branchHealth.branches} compareMode={compareMode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Store className="h-4 w-4 text-muted-foreground" />
                {t('branchChart.title')}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t('branchChart.subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border text-xs font-medium">
                {BRANCH_CHART_RANGE_OPTIONS.map((opt) => (
                  <button key={opt.id} type="button" onClick={() => onBranchChartPreset(opt.id)} className={`px-2.5 py-1.5 transition-colors ${branchChartPreset === opt.id ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {branchChartLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {branchChartError && <p className="mb-3 text-sm text-destructive">{branchChartError}</p>}
          <BranchDailySalesChart data={branchChartData} loading={branchChartLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
