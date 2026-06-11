import { setRequestLocale } from 'next-intl/server';
import { AuditView } from '@/features/audit/audit-view';

export default function AuditPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <AuditView />;
}
