'use client';

import { useTranslations } from 'next-intl';
import { LogOut, Menu } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { logout } from '@/lib/auth-api';
import { useAuthStore } from '@/stores/auth-store';
import { LocaleSwitcher } from './locale-switcher';
import { NotificationBell } from './notification-bell';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const { user, refreshToken, clear } = useAuthStore();

  async function handleLogout() {
    try {
      if (refreshToken) await logout(refreshToken);
    } catch {
      // เพิกเฉย error ตอน logout — ล้าง session ฝั่ง client เสมอ
    } finally {
      clear();
      router.replace('/login');
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label={t('menu')}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="ml-auto flex items-center gap-3">
        <NotificationBell />
        <LocaleSwitcher />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{user?.fullName ?? user?.email}</p>
          <p className="text-[11px] text-muted-foreground">{user?.roles?.[0]}</p>
        </div>
        <Button variant="outline" size="icon" onClick={handleLogout} aria-label={t('logout')}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
