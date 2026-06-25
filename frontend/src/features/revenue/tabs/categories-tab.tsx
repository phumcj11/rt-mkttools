'use client';

import { Layers } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommandCenterData } from '@/lib/revenue-api';
import { baht } from '../revenue-shared';

interface CategoriesTabProps {
  data: CommandCenterData;
}

export function CategoriesTab({ data }: CategoriesTabProps) {
  const t = useTranslations('revenue');
  const totalRevenue = useMemo(
    () => data.categories.reduce((s, c) => s + c.revenue, 0),
    [data.categories],
  );
  const maxRevenue = Math.max(1, ...data.categories.map((c) => c.revenue));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {t('tabs.categoriesTitle')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('tabs.categoriesSubtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.categories.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('tabs.categoriesEmpty')}</p>
          )}
          {data.categories.map((c, i) => {
            const share = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;
            const barW = (c.revenue / maxRevenue) * 100;
            return (
              <div key={c.category} className="rounded-lg border p-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 text-right text-sm font-semibold text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{c.category}</span>
                      <span className="text-sm font-semibold tabular-nums">{baht(c.revenue)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${barW}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span>{share.toFixed(1)}% {t('tabs.categoriesShare')}</span>
                      <span>{c.qtySold.toLocaleString('th-TH')} {t('products.qty')}</span>
                      <span>GP {c.gpPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
