import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default function CampaignsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ComingSoon titleKey="campaigns" />;
}
