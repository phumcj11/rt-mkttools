'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw, ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api';
import { listAuditLogs } from '@/lib/audit-api';
import type { AuditLogItem } from '@/lib/types';

const KNOWN_ACTIONS = new Set([
  'auth.login',
  'auth.registered',
  'billing.plan_changed',
  'billing.invoice_paid',
  'billing.invoice_voided',
  'branch.created',
  'branch.updated',
  'branch.deleted',
]);

export function AuditView() {
  const t = useTranslations('audit');

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setLogs(await listAuditLogs(200));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  const actionLabel = (action: string) =>
    KNOWN_ACTIONS.has(action) ? t(`actions.${action}`) : action;

  const formatDetails = (item: AuditLogItem) => {
    const parts: string[] = [];
    if (item.entity) parts.push(`${item.entity}${item.entityId ? ` #${item.entityId}` : ''}`);
    if (item.metadata && Object.keys(item.metadata).length > 0) {
      parts.push(JSON.stringify(item.metadata));
    }
    return parts.join(' · ') || '—';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
              <ScrollText className="h-8 w-8 text-muted-foreground/50" />
              {t('empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('time')}</TableHead>
                  <TableHead>{t('action')}</TableHead>
                  <TableHead>{t('user')}</TableHead>
                  <TableHead>{t('details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString('th-TH')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{actionLabel(item.action)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.userId ? `#${item.userId}` : '—'}
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                      {formatDetails(item)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
