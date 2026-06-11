import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export default function ResetPasswordPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
