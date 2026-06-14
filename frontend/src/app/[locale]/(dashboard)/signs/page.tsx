import { setRequestLocale } from 'next-intl/server';
import { SignsView } from '@/features/signs/signs-view';

export default function SignsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <SignsView />;
}
