import { setRequestLocale } from 'next-intl/server';
import { ProductsView } from '@/features/products/products-view';

export default function ProductsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ProductsView />;
}
