'use client';

import { AlertTriangle, TrendingDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommandCenterData } from '@/lib/revenue-api';
import { BranchHealthTable } from '../branch-health-table';
import { pctText } from '../revenue-shared';
import type { CompareMode } from '../revenue-constants';

interface DecliningTabProps {
  data: CommandCenterData;
  compareMode: CompareMode;
}

export function DecliningTab({ data, compareMode }: DecliningTabProps) {
  const t = useTranslations('revenue');
  const declining = data.branchHealth.branches.filter((b) => b.status === 'red' || b.status === 'yellow');

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">{t('branch.red')}</p><p className="mt-1 text-2xl font-bold text-red-600">{data.branchHealth.red}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">{t('branch.yellow')}</p><p className="mt-1 text-2xl font-bold text-amber-600">{data.branchHealth.yellow}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">{t('tabs.decliningTotal')}</p><p className="mt-1 text-2xl font-bold">{declining.length}</p></CardContent></Card>
      </div>

      {data.branchHealth.worstBranch && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/60 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="text-sm text-red-900">
            <p className="font-medium">{t('branch.worst')}: {data.branchHealth.worstBranch.shortcode || data.branchHealth.worstBranch.code} — {data.branchHealth.worstBranch.name}</p>
            <p className="mt-1 text-xs">MoM {pctText(data.branchHealth.worstBranch.revenueGrowthPct)} · {data.branchHealth.worstBranch.orders.toLocaleString('th-TH')} {t('kpi.bills')}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            {t('tabs.decliningList')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BranchHealthTable branches={data.branchHealth.branches} compareMode={compareMode} filter={(b) => b.status === 'red' || b.status === 'yellow'} defaultSort="revenue" />
        </CardContent>
      </Card>
    </div>
  );
}
