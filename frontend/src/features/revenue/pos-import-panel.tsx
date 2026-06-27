'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CloudDownload,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getDriveSettings, type DriveSettings } from '@/lib/media-api';
import { ApiError } from '@/lib/api';
import { listPosImportRuns, syncPosImport, type PosImportRunRow } from '@/lib/revenue-api';
import { cn } from '@/lib/utils';

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function statusCls(status: PosImportRunRow['status']) {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

interface PosImportPanelProps {
  active: boolean;
  onSynced?: () => void;
}

export function PosImportPanel({ active, onSynced }: PosImportPanelProps) {
  const t = useTranslations('revenue.posImport');
  const locale = useLocale();
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [force, setForce] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [driveSettings, setDriveSettings] = useState<DriveSettings | null>(null);
  const [runs, setRuns] = useState<PosImportRunRow[]>([]);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadMeta = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const [ds, rs] = await Promise.all([
        getDriveSettings().catch(() => null),
        listPosImportRuns({ yearMonth }).catch(() => []),
      ]);
      setDriveSettings(ds);
      setRuns(rs);
    } finally {
      setLoadingRuns(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    if (!active) return;
    void loadMeta();
  }, [active, loadMeta]);

  const handleSync = async () => {
    if (!yearMonth.match(/^\d{4}-\d{2}$/)) {
      setMessage({ type: 'err', text: t('invalidMonth') });
      return;
    }
    setSyncing(true);
    setMessage(null);
    try {
      const run = await syncPosImport(yearMonth, { force });
      setMessage({
        type: run.status === 'failed' ? 'err' : 'ok',
        text: run.status === 'failed'
          ? run.errorMessage || t('syncFailed')
          : t('syncSuccess', {
              imported: run.importedRows.toLocaleString('th-TH'),
              receipts: run.receiptCount.toLocaleString('th-TH'),
            }),
      });
      await loadMeta();
      if (run.status === 'completed') onSynced?.();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('syncFailed');
      setMessage({ type: 'err', text: msg });
    } finally {
      setSyncing(false);
    }
  };

  const configured = !!driveSettings?.pos_drive_configured;

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 md:col-span-2 xl:col-span-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
          <div>
            <p className="text-sm font-semibold text-emerald-950">{t('title')}</p>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <Link
          href={`/${locale}/media`}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
        >
          {t('openSettings')}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {!configured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('notConfigured')}</span>
        </div>
      )}

      {configured && driveSettings?.pos_drive_folder_id_preview && (
        <p className="text-xs text-emerald-800">
          {t('folderReady')}: <span className="font-mono">{driveSettings.pos_drive_folder_id_preview}</span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,160px)_auto_1fr] sm:items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t('yearMonth')}</label>
          <Input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            className="rounded border-gray-300"
          />
          {t('forceReimport')}
        </label>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadMeta()}
            disabled={loadingRuns || syncing}
          >
            {loadingRuns ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1.5">{t('refreshStatus')}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSync()}
            disabled={syncing || !configured}
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
            <span className="ml-1.5">{t('syncNow')}</span>
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">{t('fileHint')}</p>

      {message && (
        <div className={cn(
          'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
          message.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900',
        )}>
          {message.type === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {runs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-white/70">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('colFile')}</th>
                <th className="px-3 py-2 font-medium">{t('colStatus')}</th>
                <th className="px-3 py-2 font-medium">{t('colRows')}</th>
                <th className="px-3 py-2 font-medium">{t('colReceipts')}</th>
                <th className="px-3 py-2 font-medium">{t('colWhen')}</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 5).map((run) => (
                <tr key={run.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{run.filename}</td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', statusCls(run.status))}>
                      {t(`status.${run.status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {run.importedRows.toLocaleString('th-TH')}
                    {run.skippedRows > 0 ? ` (+${run.skippedRows.toLocaleString('th-TH')} skip)` : ''}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{run.receiptCount.toLocaleString('th-TH')}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {run.importedAt ? new Date(run.importedAt).toLocaleString(locale === 'th' ? 'th-TH' : 'en-US') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
