import { setRequestLocale } from 'next-intl/server';
import { AdminView } from '@/features/admin/admin-view';

export default function AdminPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <AdminView />;
}
