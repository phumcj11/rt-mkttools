import { setRequestLocale } from 'next-intl/server';
import { SettingsView } from '@/features/settings/settings-view';

export default function SettingsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <SettingsView />;
}
