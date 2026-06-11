import { Link } from '@/i18n/navigation';

export default function LocaleNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-bold text-primary">404</h1>
      <p className="text-muted-foreground">ไม่พบหน้าที่คุณค้นหา</p>
      <Link href="/dashboard" className="font-medium text-primary hover:underline">
        กลับแดชบอร์ด
      </Link>
    </main>
  );
}
