'use client';

import { ChevronRight, Gift, Package, PackageX, Store, TrendingDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommandCenterData } from '@/lib/revenue-api';
import { baht } from '../revenue-shared';

interface ProductsTabProps {
  data: CommandCenterData;
}

export function ProductsTab({ data }: ProductsTabProps) {
  const t = useTranslations('revenue');

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                {t('products.top')}
              </CardTitle>
              <Link href="/promotions">
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                  <Gift className="h-3.5 w-3.5" />
                  {t('actions.planner')}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.topProducts.slice(0, 12).map((p, i) => (
                <div key={p.sku} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                  <span className="w-5 text-right text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium leading-tight">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{baht(p.revenue)}</div>
                    <div className="text-[11px] text-muted-foreground">GP {p.gpPct.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <PackageX className="h-4 w-4 text-muted-foreground" />
                {t('products.slow')}
              </CardTitle>
              <Link href="/promotions">
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {t('actions.clearance')}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.slowMoving.slice(0, 12).map((p) => (
                <div key={p.sku} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
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
          </CardContent>
        </Card>
      </div>

      {data.frontStoreCandidates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-muted-foreground" />
              {t('products.frontStore')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.frontStoreCandidates.slice(0, 12).map((p) => (
                <Link key={p.sku} href={`/content?sku=${encodeURIComponent(p.sku)}&product=${encodeURIComponent(p.name)}&price=${p.retailPrice}`}>
                  <div className="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-foreground">
                    <span className="max-w-[160px] truncate">{p.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
