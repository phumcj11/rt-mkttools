'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications-api';
import { useNotificationsStore } from '@/stores/notifications-store';

export function NotificationBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const items = useNotificationsStore((s) => s.items);
  const unread = useNotificationsStore((s) => s.unread);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllReadLocal = useNotificationsStore((s) => s.markAllRead);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function onItemClick(id: number, isRead: boolean) {
    if (isRead) return;
    markRead(id);
    try {
      await markNotificationRead(id);
    } catch {
      // เงียบไว้ — สถานะ local อัปเดตแล้ว
    }
  }

  async function onMarkAll() {
    markAllReadLocal();
    try {
      await markAllNotificationsRead();
    } catch {
      // เงียบไว้
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('title')}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-semibold">{t('title')}</p>
            {unread > 0 && (
              <button
                onClick={onMarkAll}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n.id, n.isRead)}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent',
                    !n.isRead && 'bg-primary/5',
                  )}
                >
                  <div className="flex w-full items-center gap-2">
                    {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <span className="flex-1 text-sm font-medium">{n.title}</span>
                  </div>
                  {n.body && (
                    <span className="text-xs text-muted-foreground">{n.body}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
