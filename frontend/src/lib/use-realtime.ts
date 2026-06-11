'use client';

import { useEffect } from 'react';
import { listNotifications } from '@/lib/notifications-api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationsStore } from '@/stores/notifications-store';
import type { Notification } from '@/lib/types';

/**
 * เชื่อม socket + โหลด notification เริ่มต้น และฟัง event `notification:new`
 * เรียกครั้งเดียวระดับ AppShell
 */
export function useRealtime() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setItems = useNotificationsStore((s) => s.setItems);
  const prepend = useNotificationsStore((s) => s.prepend);
  const reset = useNotificationsStore((s) => s.reset);

  useEffect(() => {
    if (!hydrated || !accessToken) return;

    listNotifications()
      .then(setItems)
      .catch(() => undefined);

    const socket = connectSocket();

    const onNew = (n: Notification) => prepend(n);
    socket.on('notification:new', onNew);

    return () => {
      socket.off('notification:new', onNew);
      disconnectSocket();
      reset();
    };
  }, [hydrated, accessToken, setItems, prepend, reset]);
}
