'use client';

import { Banknote, Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CommandCenterData } from '@/lib/revenue-api';

interface CampaignTabProps {
  data: CommandCenterData;
}

export function CampaignTab({ data }: CampaignTabProps) {
  const t = useTranslations('revenue');
  const promo = data.billNearPromo;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {promo.buckets.map((b) => (
          <Card key={b.id}>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground">{b.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{b.count.toLocaleString('th-TH')}</p>
              <p className="text-[11px] text-muted-foreground">{t('kpi.bills')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!promo.available && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/40 p-4">
          <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-medium text-amber-900">{t('billPromo.title')}</p>
            <p className="mt-1 text-xs text-amber-800">{promo.message}</p>
            {promo.source && <p className="mt-1 text-[11px] text-muted-foreground">ERP: {promo.source}</p>}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gift className="h-4 w-4 text-muted-foreground" />
              {t('tabs.campaignTable')}
            </CardTitle>
            {promo.available && (
              <Badge variant="secondary" className="text-xs">
                {promo.totalBills.toLocaleString('th-TH')} {t('tabs.campaignTotalBills')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('branch.name')}</TableHead>
                  {promo.buckets.map((b) => (
                    <TableHead key={b.id} className="text-right text-xs">{b.label}</TableHead>
                  ))}
                  <TableHead className="text-right">{t('tabs.campaignRowTotal')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promo.branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium leading-tight">{b.name}</div>
                      <div className="text-[11px] text-muted-foreground">{b.shortcode || b.code}</div>
                    </TableCell>
                    {b.buckets.map((bk) => (
                      <TableCell key={bk.id} className="text-right tabular-nums">{bk.count.toLocaleString('th-TH')}</TableCell>
                    ))}
                    <TableCell className="text-right font-semibold tabular-nums">{b.total.toLocaleString('th-TH')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
