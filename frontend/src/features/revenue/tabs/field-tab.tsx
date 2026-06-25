'use client';

import { Camera, Loader2, Store } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { CommandCenterData, StorefrontActivityRow } from '@/lib/revenue-api';
import { createStorefrontActivity, listStorefrontActivities } from '@/lib/revenue-api';
import { ApiError } from '@/lib/api';
import { showError, showSuccess } from '@/lib/sweetalert';
import { localDateInput } from '../revenue-shared';

interface FieldTabProps {
  data: CommandCenterData;
}

function resolvePhotoUrl(url: string) {
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/uploads/${url}`;
}

export function FieldTab({ data }: FieldTabProps) {
  const t = useTranslations('revenue');
  const [activities, setActivities] = useState<StorefrontActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [activityDate, setActivityDate] = useState(localDateInput(new Date()));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoFiles, setPhotoFiles] = useState<string[]>([]);

  const branchOptions = data.activeBranches.length > 0
    ? data.activeBranches
    : data.branchHealth.branches.map((b) => ({ id: b.id, code: b.code, shortcode: b.shortcode, name: b.name }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listStorefrontActivities({ from: data.period.mtdFrom, to: data.period.mtdTo });
      setActivities(rows);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [data.period.mtdFrom, data.period.mtdTo]);

  useEffect(() => { void load(); }, [load]);

  const summaryByBranch = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of activities) map.set(a.branchId, (map.get(a.branchId) ?? 0) + 1);
    return branchOptions
      .map((b) => ({ ...b, count: map.get(b.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [activities, branchOptions]);

  const handlePhotoChange = (files: FileList | null) => {
    if (!files?.length) return;
    const readers = Array.from(files).slice(0, 6).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
    );
    void Promise.all(readers).then(setPhotoFiles).catch(() => showError(t('tabs.fieldPhotoFailed')));
  };

  const handleSubmit = async () => {
    const bid = parseInt(branchId, 10);
    if (!Number.isFinite(bid) || !activityDate || !title.trim()) {
      showError(t('setup.invalid'));
      return;
    }
    const branch = branchOptions.find((b) => b.id === bid);
    setSaving(true);
    try {
      await createStorefrontActivity({
        branchId: bid,
        branchCode: branch?.code ?? null,
        activityDate,
        title: title.trim(),
        description: description.trim() || null,
        photoDataUrls: photoFiles.length ? photoFiles : undefined,
      });
      showSuccess(t('tabs.fieldSaved'));
      setTitle('');
      setDescription('');
      setPhotoFiles([]);
      await load();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('setup.failed'));
    } finally {
      setSaving(false);
    }
  };

  const recentPhotos = activities
    .flatMap((a) => (a.photoUrls ?? []).map((url) => ({ url, branchId: a.branchId, title: a.title, date: a.activityDate })))
    .slice(0, 24);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">{t('tabs.fieldTotal')}</p><p className="mt-1 text-2xl font-bold">{activities.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">{t('tabs.fieldBranches')}</p><p className="mt-1 text-2xl font-bold">{summaryByBranch.filter((b) => b.count > 0).length}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">{t('tabs.fieldPhotos')}</p><p className="mt-1 text-2xl font-bold">{recentPhotos.length}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-muted-foreground" />
              {t('tabs.fieldByBranch')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summaryByBranch.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{b.shortcode || b.code} — {b.name}</span>
                <span className="font-semibold tabular-nums">{b.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('tabs.fieldAdd')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <NativeSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('setup.selectBranch')}</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.shortcode || b.code} — {b.name}</option>
              ))}
            </NativeSelect>
            <Input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
            <Input placeholder={t('tabs.fieldTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder={t('tabs.fieldDesc')} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div>
              <Label className="text-xs text-muted-foreground">{t('tabs.fieldUpload')}</Label>
              <Input type="file" accept="image/*" multiple className="mt-1" onChange={(e) => handlePhotoChange(e.target.files)} />
            </div>
            <Button className="w-full" onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('tabs.fieldSave')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4 text-muted-foreground" />
            {t('tabs.fieldGallery')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('tabs.fieldLoading')}
            </div>
          ) : recentPhotos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('tabs.fieldEmpty')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {recentPhotos.map((p, i) => (
                <div key={`${p.url}-${i}`} className="overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolvePhotoUrl(p.url)} alt={p.title} className="aspect-square w-full object-cover" />
                  <div className="px-2 py-1.5 text-[10px] text-muted-foreground">{p.date}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
