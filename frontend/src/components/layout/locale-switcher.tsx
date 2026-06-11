'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function LocaleSwitcher() {
  const t = useTranslations('locale');
  const pathname = usePathname();
  const active = useLocale();

  return (
    <div className="inline-flex items-center rounded-md border bg-background p-0.5 text-xs">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          className={cn(
            'rounded px-2 py-1 font-medium transition-colors',
            active === locale
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t(locale)}
        </Link>
      ))}
    </div>
  );
}
