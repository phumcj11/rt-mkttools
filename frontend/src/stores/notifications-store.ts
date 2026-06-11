import { create } from 'zustand';
import type { Notification } from '@/lib/types';

interface NotificationsState {
  items: Notification[];
  unread: number;
  loaded: boolean;
  setItems: (items: Notification[]) => void;
  setUnread: (count: number) => void;
  prepend: (item: Notification) => void;
  markRead: (id: number) => void;
  markAllRead: () => void;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  items: [],
  unread: 0,
  loaded: false,
  setItems: (items) =>
    set({ items, unread: items.filter((n) => !n.isRead).length, loaded: true }),
  setUnread: (count) => set({ unread: count }),
  prepend: (item) =>
    set((state) => ({
      items: [item, ...state.items].slice(0, 50),
      unread: state.unread + 1,
    })),
  markRead: (id) =>
    set((state) => {
      const target = state.items.find((n) => n.id === id);
      const wasUnread = target && !target.isRead;
      return {
        items: state.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        unread: wasUnread ? Math.max(0, state.unread - 1) : state.unread,
      };
    }),
  markAllRead: () =>
    set((state) => ({
      items: state.items.map((n) => ({ ...n, isRead: true })),
      unread: 0,
    })),
  reset: () => set({ items: [], unread: 0, loaded: false }),
}));
