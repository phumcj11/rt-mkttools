import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/features/auth/login-form';

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <LoginForm />;
}
