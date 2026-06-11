import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/features/auth/login-form';

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
