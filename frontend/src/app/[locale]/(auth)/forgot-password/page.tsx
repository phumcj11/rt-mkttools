import { setRequestLocale } from 'next-intl/server';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export default function ForgotPasswordPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ForgotPasswordForm />;
}
