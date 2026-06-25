'use client';

import { Calculator, Receipt, ShoppingCart, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CommandCenterData } from '@/lib/revenue-api';
import { BranchHealthTable } from '../branch-health-table';
import { baht, CompareRow } from '../revenue-shared';
import type { CompareMode } from '../revenue-constants';
import { ComparePeriodBar, SectionCard, StatTile, TabHero } from '../revenue-ui';

interface BillsAvgTabProps {
  data: CommandCenterData;
  compareMode: CompareMode;
}

function compareSub(
  compareMode: CompareMode,
  mom: { label: string; prev: number; pct: number | null; fmt?: (v: number) => string; unavailable?: boolean },
  yoy: { label: string; prev: number; pct: number | null; fmt?: (v: number) => string; unavailable?: boolean },
) {
  return (
    <div className="space-y-0.5">
      {(compareMode === 'mom' || compareMode === 'both') && (
        <CompareRow label={mom.label} prevValue={mom.prev} pct={mom.pct} formatFn={mom.fmt} unavailable={mom.unavailable} />
      )}
      {(compareMode === 'yoy' || compareMode === 'both') && (
        <CompareRow
          label={yoy.label}
          prevValue={yoy.prev}
          pct={yoy.pct}
          formatFn={yoy.fmt}
          labelClass="text-amber-700"
          unavailable={yoy.unavailable}
        />
      )}
    </div>
  );
}

export function BillsAvgTab({ data, compareMode }: BillsAvgTabProps) {
  const t = useTranslations('revenue');
  const totalOrders = data.branchHealth.branches.reduce((s, b) => s + b.orders, 0);
  const avgAll = totalOrders > 0 ? data.kpi.mtd.revenue / totalOrders : 0;

  return (
    <div className="space-y-5">
      <TabHero tabId="bills-avg" title={t('tabs.billsAvg')} subtitle={t('tabHero.billsAvg')} />
      <ComparePeriodBar compareMode={compareMode} period={data.period} />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          tone="cyan"
          icon={ShoppingCart}
          label={t('kpi.transactions')}
          value={data.kpi.mtd.orders.toLocaleString('th-TH')}
          sub={compareSub(
            compareMode,
            { label: 'MoM', prev: data.kpi.prevPeriod.orders, pct: data.kpi.ordersGrowthPct, fmt: (v) => v.toLocaleString('th-TH') },
            { label: 'YoY', prev: data.kpi.yoyPeriod.orders, pct: data.kpi.yoyOrdersGrowthPct, fmt: (v) => v.toLocaleString('th-TH'), unavailable: !data.kpi.yoyReliable },
          )}
        />
        <StatTile
          tone="blue"
          icon={Wallet}
          label={t('kpi.avgBill')}
          value={baht(data.kpi.mtd.avgTicket)}
          sub={compareSub(
            compareMode,
            { label: 'MoM', prev: data.kpi.prevPeriod.avgTicket, pct: data.kpi.avgTicketGrowthPct },
            { label: 'YoY', prev: data.kpi.yoyPeriod.avgTicket, pct: data.kpi.yoyAvgTicketGrowthPct, unavailable: !data.kpi.yoyReliable },
          )}
        />
        <StatTile tone="emerald" icon={Calculator} label={t('tabs.billsAvgWeighted')} value={baht(avgAll)} hint={t('tabs.billsAvgHint')} />
      </div>
      <SectionCard tone="cyan" icon={Receipt} title={t('tabs.billsAvgTable')} subtitle={t('tabHero.billsAvgTable')}>
        <BranchHealthTable branches={data.branchHealth.branches} compareMode={compareMode} defaultSort="orders" emphasize="bills" />
      </SectionCard>
    </div>
  );
}
