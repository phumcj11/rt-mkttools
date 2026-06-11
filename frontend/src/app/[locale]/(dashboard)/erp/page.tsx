import { setRequestLocale } from 'next-intl/server';
import { ErpView } from '@/features/erp/erp-view';

export default function ErpPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ErpView />;
}
