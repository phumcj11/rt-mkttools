'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useRealtime } from '@/lib/use-realtime';
import { useAuthStore } from '@/stores/auth-store';
import { SidebarNav } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrated, accessToken } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useRealtime();

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hydrated, accessToken, router]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar — desktop */}
      <aside className="hidden border-r bg-card lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarNav />
        </div>
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              'absolute inset-y-0 left-0 w-[260px] bg-card shadow-xl',
              'animate-in slide-in-from-left',
            )}
          >
            <button
              className="absolute right-3 top-4 text-muted-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="close"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
