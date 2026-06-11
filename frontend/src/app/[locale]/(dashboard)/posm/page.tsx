import { setRequestLocale } from 'next-intl/server';
import { PosmView } from '@/features/posm/posm-view';

export default function PosmPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <PosmView />;
}
