import { setRequestLocale } from 'next-intl/server';
import { DashboardView } from '@/features/dashboard/dashboard-view';

export default function DashboardPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <DashboardView />;
}
