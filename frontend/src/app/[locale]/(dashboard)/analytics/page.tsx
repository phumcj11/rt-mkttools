import { setRequestLocale } from 'next-intl/server';
import { AnalyticsView } from '@/features/analytics/analytics-view';

export default function AnalyticsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <AnalyticsView />;
}
