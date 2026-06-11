import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default function SettingsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ComingSoon titleKey="settings" />;
}
