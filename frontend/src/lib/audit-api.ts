import { apiRequest } from './api';
import type { AuditLogItem } from './types';

export function listAuditLogs(limit = 100, action?: string) {
  const q = action ? `&action=${encodeURIComponent(action)}` : '';
  return apiRequest<AuditLogItem[]>(`/audit-logs?limit=${limit}${q}`);
}
