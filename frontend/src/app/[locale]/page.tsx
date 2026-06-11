import { setRequestLocale } from 'next-intl/server';
import { Landing } from '@/components/landing';

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <Landing />;
}
