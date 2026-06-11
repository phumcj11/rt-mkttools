import { setRequestLocale } from 'next-intl/server';
import { RegisterForm } from '@/features/auth/register-form';

export default function RegisterPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <RegisterForm />;
}
