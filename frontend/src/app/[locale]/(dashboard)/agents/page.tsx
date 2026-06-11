import { setRequestLocale } from 'next-intl/server';
import { AgentsView } from '@/features/agents/agents-view';

export default function AgentsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <AgentsView />;
}
