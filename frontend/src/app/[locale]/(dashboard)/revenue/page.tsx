import { setRequestLocale } from 'next-intl/server';
import { RevenueCommandCenterView } from '@/features/revenue/revenue-command-center-view';

export default function RevenuePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <RevenueCommandCenterView />;
}
