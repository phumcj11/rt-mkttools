import { apiRequest } from './api';
import type { Notification } from './types';

export function listNotifications() {
  return apiRequest<Notification[]>('/notifications');
}

export function fetchUnreadCount() {
  return apiRequest<{ count: number }>('/notifications/unread-count');
}

export function markNotificationRead(id: number) {
  return apiRequest<{ id: number }>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiRequest<{ count: number }>('/notifications/read-all', { method: 'PATCH' });
}
