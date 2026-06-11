import { setRequestLocale } from 'next-intl/server';
import { SocialView } from '@/features/social/social-view';

export default function SocialPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <SocialView />;
}
