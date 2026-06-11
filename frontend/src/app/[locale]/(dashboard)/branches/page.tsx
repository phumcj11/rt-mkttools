import { setRequestLocale } from 'next-intl/server';
import { BranchesView } from '@/features/branches/branches-view';

export default function BranchesPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <BranchesView />;
}
