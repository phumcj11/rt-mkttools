'use client';

import { Receipt } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommandCenterData } from '@/lib/revenue-api';
import { BranchHealthTable } from '../branch-health-table';
import { baht, KpiCard } from '../revenue-shared';
import type { CompareMode } from '../revenue-constants';

interface BillsAvgTabProps {
  data: CommandCenterData;
  compareMode: CompareMode;
}

export function BillsAvgTab({ data, compareMode }: BillsAvgTabProps) {
  const t = useTranslations('revenue');
  const totalOrders = data.branchHealth.branches.reduce((s, b) => s + b.orders, 0);
  const avgAll = totalOrders > 0 ? data.kpi.mtd.revenue / totalOrders : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label={t('kpi.transactions')} value={data.kpi.mtd.orders.toLocaleString('th-TH')} icon={Receipt} accent="text-primary" />
        <KpiCard label={t('kpi.avgBill')} value={baht(data.kpi.mtd.avgTicket)} icon={Receipt} accent="text-slate-600" />
        <KpiCard label={t('tabs.billsAvgWeighted')} value={baht(avgAll)} sub={<span className="text-xs text-muted-foreground">{t('tabs.billsAvgHint')}</span>} icon={Receipt} accent="text-emerald-600" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            {t('tabs.billsAvgTable')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BranchHealthTable branches={data.branchHealth.branches} compareMode={compareMode} defaultSort="orders" emphasize="bills" />
        </CardContent>
      </Card>
    </div>
  );
}
