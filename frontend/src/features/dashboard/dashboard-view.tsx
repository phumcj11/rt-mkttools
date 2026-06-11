'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BarChart3, Loader2, Megaphone, Package, Sparkles, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAnalyticsSummary } from '@/lib/analytics-api';
import type { AnalyticsSummary } from '@/lib/types';
import { useAuthStore } from '@/stores/auth-store';

interface Stat {
  key: string;
  icon: LucideIcon;
  tone: string;
  value: (s: AnalyticsSummary) => string;
}

const STATS: Stat[] = [
  {
    key: 'totalSales',
    icon: BarChart3,
    tone: 'text-primary',
    value: (s) => `฿${Math.round(s.totalSales).toLocaleString('th-TH')}`,
  },
  {
    key: 'activeCampaigns',
    icon: Megaphone,
    tone: 'text-gold',
    value: (s) => s.activeCampaigns.toLocaleString('th-TH'),
  },
  {
    key: 'totalProducts',
    icon: Package,
    tone: 'text-primary',
    value: (s) => s.totalProducts.toLocaleString('th-TH'),
  },
  {
    key: 'aiUsage',
    icon: Sparkles,
    tone: 'text-gold',
    value: (s) => s.aiTokens.toLocaleString('th-TH'),
  },
];

export function DashboardView() {
  const t = useTranslations('dashboard');
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAnalyticsSummary(30)
      .then((s) => {
        if (active) setSummary(s);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('welcome')}, {tenant?.name ?? user?.fullName ?? user?.email}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t(stat.key)}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.tone}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : summary ? (
                    stat.value(summary)
                  ) : (
                    '—'
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t('thisMonth')}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t('placeholderNote')}
        </CardContent>
      </Card>
    </div>
  );
}
