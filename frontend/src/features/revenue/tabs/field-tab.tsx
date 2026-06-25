'use client';

import { Camera, Image, Loader2, MapPin, Plus, Store } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { CommandCenterData, StorefrontActivityRow } from '@/lib/revenue-api';
import { createStorefrontActivity, listStorefrontActivities } from '@/lib/revenue-api';
import { ApiError } from '@/lib/api';
import { showError, showSuccess } from '@/lib/sweetalert';
import { localDateInput } from '../revenue-shared';
import { SectionCard, StatTile, TabHero } from '../revenue-ui';

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
    <div className="space-y-5">
      <TabHero tabId="field" title={t('tabs.field')} subtitle={t('tabHero.field')} />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile tone="teal" icon={Camera} label={t('tabs.fieldTotal')} value={activities.length} />
        <StatTile tone="cyan" icon={Store} label={t('tabs.fieldBranches')} value={summaryByBranch.filter((b) => b.count > 0).length} />
        <StatTile tone="blue" icon={Image} label={t('tabs.fieldPhotos')} value={recentPhotos.length} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard tone="teal" icon={MapPin} title={t('tabs.fieldByBranch')} subtitle={t('tabHero.fieldByBranch')}>
          <div className="space-y-2">
            {summaryByBranch.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/40 px-3 py-2.5 text-sm transition-colors hover:bg-teal-50">
                <span className="font-medium">{b.shortcode || b.code} — {b.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${b.count > 0 ? 'bg-teal-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {b.count}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard tone="cyan" icon={Plus} title={t('tabs.fieldAdd')} subtitle={t('tabHero.fieldAdd')}>
          <div className="space-y-3">
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
              <Label className="text-xs font-medium text-muted-foreground">{t('tabs.fieldUpload')}</Label>
              <Input type="file" accept="image/*" multiple className="mt-1 border-dashed" onChange={(e) => handlePhotoChange(e.target.files)} />
            </div>
            <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('tabs.fieldSave')}
            </Button>
          </div>
        </SectionCard>
      </div>

      <SectionCard tone="blue" icon={Camera} title={t('tabs.fieldGallery')} subtitle={t('tabHero.fieldGallery')}>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-teal-500" />
            {t('tabs.fieldLoading')}
          </div>
        ) : recentPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
              <Image className="h-7 w-7" />
            </span>
            <p className="text-sm text-muted-foreground">{t('tabs.fieldEmpty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {recentPhotos.map((p, i) => (
              <div key={`${p.url}-${i}`} className="group overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolvePhotoUrl(p.url)} alt={p.title} className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 px-2 py-1.5 text-[10px] font-medium text-teal-800">{p.date}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
