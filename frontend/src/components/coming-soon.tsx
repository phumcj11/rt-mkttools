'use client';

import { useTranslations } from 'next-intl';
import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function ComingSoon({ titleKey }: { titleKey: string }) {
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{tNav(titleKey)}</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Construction className="h-7 w-7" />
          </span>
          <p className="text-lg font-medium">{tCommon('comingSoon')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
