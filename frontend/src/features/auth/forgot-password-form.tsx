'use client';

import { FormEvent, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { forgotPassword } from '@/lib/auth-api';

export function ForgotPasswordForm() {
  const t = useTranslations();
  const locale = useLocale();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setResetUrl(null);
    setLoading(true);
    try {
      const result = await forgotPassword(email, locale);
      setSuccess(t('auth.forgotPasswordSuccess'));
      if (result.resetUrl) {
        setResetUrl(result.resetUrl);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 0 ? t('errors.network') : err.message);
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl">{t('auth.forgotPasswordTitle')}</CardTitle>
        <CardDescription>{t('auth.forgotPasswordSubtitle')}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              <p>{success}</p>
              {resetUrl && (
                <div className="space-y-1">
                  <p className="font-medium">{t('auth.resetLinkLabel')}</p>
                  <a
                    href={resetUrl}
                    className="break-all font-medium text-primary hover:underline"
                  >
                    {resetUrl}
                  </a>
                  <p className="text-xs text-muted-foreground">{t('auth.resetLinkHint')}</p>
                </div>
              )}
            </div>
          )}
          {!success && (
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          {!success && (
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t('common.processing') : t('auth.forgotPasswordSubmit')}
            </Button>
          )}
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
