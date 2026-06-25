'use client';

import { AlertTriangle, Minus, TrendingDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CommandCenterData } from '@/lib/revenue-api';
import { BranchHealthTable } from '../branch-health-table';
import { pctText } from '../revenue-shared';
import type { CompareMode } from '../revenue-constants';
import { SectionCard, StatTile, TabHero } from '../revenue-ui';

interface DecliningTabProps {
  data: CommandCenterData;
  compareMode: CompareMode;
}

export function DecliningTab({ data, compareMode }: DecliningTabProps) {
  const t = useTranslations('revenue');
  const declining = data.branchHealth.branches.filter((b) => b.status === 'red' || b.status === 'yellow');

  return (
    <div className="space-y-5">
      <TabHero tabId="declining" title={t('tabs.declining')} subtitle={t('tabHero.declining')} />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile tone="rose" icon={TrendingDown} label={t('branch.red')} value={data.branchHealth.red} valueClassName="text-red-600" />
        <StatTile tone="amber" icon={Minus} label={t('branch.yellow')} value={data.branchHealth.yellow} valueClassName="text-amber-600" />
        <StatTile tone="orange" icon={AlertTriangle} label={t('tabs.decliningTotal')} value={declining.length} />
      </div>

      {data.branchHealth.worstBranch && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-4 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="text-sm text-red-900">
            <p className="font-semibold">{t('branch.worst')}: {data.branchHealth.worstBranch.shortcode || data.branchHealth.worstBranch.code} — {data.branchHealth.worstBranch.name}</p>
            <p className="mt-1 text-xs">MoM {pctText(data.branchHealth.worstBranch.revenueGrowthPct)} · {data.branchHealth.worstBranch.orders.toLocaleString('th-TH')} {t('kpi.bills')}</p>
          </div>
        </div>
      )}

      <SectionCard tone="rose" icon={TrendingDown} title={t('tabs.decliningList')} subtitle={t('tabHero.decliningList')}>
        <BranchHealthTable branches={data.branchHealth.branches} compareMode={compareMode} filter={(b) => b.status === 'red' || b.status === 'yellow'} defaultSort="revenue" />
      </SectionCard>
    </div>
  );
}
