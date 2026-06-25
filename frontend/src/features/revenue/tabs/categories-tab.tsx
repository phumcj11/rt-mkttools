'use client';

import { Layers } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { CommandCenterData } from '@/lib/revenue-api';
import { baht } from '../revenue-shared';
import { RANK_BAR_COLORS, RankBadge, SectionCard, TabHero } from '../revenue-ui';

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
    <div className="space-y-5">
      <TabHero tabId="categories" title={t('tabs.categoriesTitle')} subtitle={t('tabs.categoriesSubtitle')} />
      <SectionCard tone="orange" icon={Layers} title={t('tabs.categoriesTitle')} subtitle={`${data.categories.length} หมวด · MTD`}>
        <div className="space-y-3">
          {data.categories.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('tabs.categoriesEmpty')}</p>
          )}
          {data.categories.map((c, i) => {
            const share = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;
            const barW = (c.revenue / maxRevenue) * 100;
            const barColor = RANK_BAR_COLORS[i % RANK_BAR_COLORS.length];
            return (
              <div key={c.category} className="rounded-xl border bg-gradient-to-r from-orange-50/50 to-transparent p-3 transition-shadow hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <RankBadge rank={i + 1} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{c.category}</span>
                      <span className="text-sm font-bold tabular-nums text-orange-700">{baht(c.revenue)}</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${barW}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span className="font-medium text-orange-600">{share.toFixed(1)}% {t('tabs.categoriesShare')}</span>
                      <span>{c.qtySold.toLocaleString('th-TH')} {t('products.qty')}</span>
                      <span>GP {c.gpPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
