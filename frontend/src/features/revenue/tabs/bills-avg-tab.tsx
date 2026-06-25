'use client';

import { Calculator, Receipt, ShoppingCart, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CommandCenterData } from '@/lib/revenue-api';
import { BranchHealthTable } from '../branch-health-table';
import { baht } from '../revenue-shared';
import type { CompareMode } from '../revenue-constants';
import { SectionCard, StatTile, TabHero } from '../revenue-ui';

interface BillsAvgTabProps {
  data: CommandCenterData;
  compareMode: CompareMode;
}

export function BillsAvgTab({ data, compareMode }: BillsAvgTabProps) {
  const t = useTranslations('revenue');
  const totalOrders = data.branchHealth.branches.reduce((s, b) => s + b.orders, 0);
  const avgAll = totalOrders > 0 ? data.kpi.mtd.revenue / totalOrders : 0;

  return (
    <div className="space-y-5">
      <TabHero tabId="bills-avg" title={t('tabs.billsAvg')} subtitle={t('tabHero.billsAvg')} />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile tone="cyan" icon={ShoppingCart} label={t('kpi.transactions')} value={data.kpi.mtd.orders.toLocaleString('th-TH')} />
        <StatTile tone="blue" icon={Wallet} label={t('kpi.avgBill')} value={baht(data.kpi.mtd.avgTicket)} />
        <StatTile tone="emerald" icon={Calculator} label={t('tabs.billsAvgWeighted')} value={baht(avgAll)} hint={t('tabs.billsAvgHint')} />
      </div>
      <SectionCard tone="cyan" icon={Receipt} title={t('tabs.billsAvgTable')} subtitle={t('tabHero.billsAvgTable')}>
        <BranchHealthTable branches={data.branchHealth.branches} compareMode={compareMode} defaultSort="orders" emphasize="bills" />
      </SectionCard>
    </div>
  );
}
