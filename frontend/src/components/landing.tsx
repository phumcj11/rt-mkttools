'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';

export function Landing() {
  const t = useTranslations();
  const router = useRouter();
  const { accessToken, hydrated } = useAuthStore();

  useEffect(() => {
    if (hydrated && accessToken) {
      router.replace('/dashboard');
    }
  }, [hydrated, accessToken, router]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-background" />

      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold-foreground">
        <Sparkles className="h-4 w-4 text-gold" />
        {t('common.appTagline')}
      </div>

      <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        <span className="text-primary">{t('common.appName')}</span>
      </h1>
      <p className="mt-4 max-w-xl text-balance text-muted-foreground">
        {t('auth.registerSubtitle')}
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-sm sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/login">{t('auth.loginSubmit')}</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
          <Link href="/register">{t('auth.registerSubmit')}</Link>
        </Button>
      </div>
    </main>
  );
}
