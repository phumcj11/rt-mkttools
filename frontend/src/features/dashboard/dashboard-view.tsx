'use client';

import { useTranslations } from 'next-intl';
import { BarChart3, Megaphone, Package, Sparkles, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';

interface Stat {
  key: string;
  value: string;
  icon: LucideIcon;
  tone: string;
}

const STATS: Stat[] = [
  { key: 'totalSales', value: '฿0', icon: BarChart3, tone: 'text-primary' },
  { key: 'activeCampaigns', value: '0', icon: Megaphone, tone: 'text-gold' },
  { key: 'totalProducts', value: '0', icon: Package, tone: 'text-primary' },
  { key: 'aiUsage', value: '0', icon: Sparkles, tone: 'text-gold' },
];

export function DashboardView() {
  const t = useTranslations('dashboard');
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);

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
                <div className="text-2xl font-bold">{stat.value}</div>
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
