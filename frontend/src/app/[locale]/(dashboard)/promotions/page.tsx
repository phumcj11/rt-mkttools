import { setRequestLocale } from 'next-intl/server';
import { PromotionsView } from '@/features/promotions/promotions-view';

export default function PromotionsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <PromotionsView />;
}
