import { setRequestLocale } from 'next-intl/server';
import { CampaignsView } from '@/features/campaigns/campaigns-view';

export default function CampaignsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <CampaignsView />;
}
