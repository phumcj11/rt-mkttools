'use client';

import { ChevronRight, Gift, Package, PackageX, Store, TrendingDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CommandCenterData } from '@/lib/revenue-api';
import { baht } from '../revenue-shared';
import { RankBadge, SectionCard, TabHero } from '../revenue-ui';

interface ProductsTabProps {
  data: CommandCenterData;
}

export function ProductsTab({ data }: ProductsTabProps) {
  const t = useTranslations('revenue');

  return (
    <div className="space-y-5">
      <TabHero tabId="products" title={t('tabs.products')} subtitle={t('tabHero.products')} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          tone="emerald"
          icon={Package}
          title={t('products.top')}
          subtitle={`Top ${Math.min(12, data.topProducts.length)} · MTD`}
          action={
            <Link href="/promotions">
              <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700">
                <Gift className="h-3.5 w-3.5" />
                {t('actions.planner')}
              </Button>
            </Link>
          }
        >
          <div className="space-y-1">
            {data.topProducts.slice(0, 12).map((p, i) => (
              <div key={p.sku} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-emerald-50/60">
                <RankBadge rank={i + 1} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium leading-tight">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.category}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums text-emerald-700">{baht(p.revenue)}</div>
                  <div className="text-[11px] text-muted-foreground">GP {p.gpPct.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          tone="rose"
          icon={PackageX}
          title={t('products.slow')}
          subtitle={t('tabHero.slowProducts')}
          action={
            <Link href="/promotions">
              <Button size="sm" variant="outline" className="h-8 gap-1.5 border-rose-200 text-xs text-rose-700 hover:bg-rose-50">
                <TrendingDown className="h-3.5 w-3.5" />
                {t('actions.clearance')}
              </Button>
            </Link>
          }
        >
          <div className="space-y-1">
            {data.slowMoving.slice(0, 12).map((p) => (
              <div key={p.sku} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-rose-50/50">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium leading-tight">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.category}</div>
                </div>
                <Badge variant={p.qtySold === 0 ? 'destructive' : 'secondary'} className="text-xs tabular-nums">
                  {p.qtySold} ชิ้น
                </Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {data.frontStoreCandidates.length > 0 && (
        <SectionCard tone="violet" icon={Store} title={t('products.frontStore')} subtitle={t('tabHero.frontStore')}>
          <div className="flex flex-wrap gap-2">
            {data.frontStoreCandidates.slice(0, 12).map((p) => (
              <Link key={p.sku} href={`/content?sku=${encodeURIComponent(p.sku)}&product=${encodeURIComponent(p.name)}&price=${p.retailPrice}`}>
                <div className="flex cursor-pointer items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm transition-all hover:border-violet-400 hover:bg-violet-100 hover:shadow-sm">
                  <span className="max-w-[160px] truncate font-medium text-violet-900">{p.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
