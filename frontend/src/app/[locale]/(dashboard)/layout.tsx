import { setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/components/layout/app-shell';

export default function DashboardLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <AppShell>{children}</AppShell>;
}
