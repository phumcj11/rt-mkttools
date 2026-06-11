'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarRange, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { Badge, BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api';
import {
  createCampaign,
  createPromotion,
  deleteCampaign,
  deletePromotion,
  listCampaigns,
  listPromotions,
  updateCampaign,
} from '@/lib/campaigns-api';
import type {
  Campaign,
  CampaignInput,
  CampaignStatus,
  DiscountType,
  Promotion,
  PromotionInput,
} from '@/lib/types';

const STATUSES: CampaignStatus[] = ['draft', 'scheduled', 'running', 'completed', 'archived'];
const DISCOUNT_TYPES: DiscountType[] = ['percent', 'amount', 'bundle'];

const statusVariant: Record<CampaignStatus, BadgeProps['variant']> = {
  draft: 'muted',
  scheduled: 'warning',
  running: 'success',
  completed: 'secondary',
  archived: 'muted',
};

const emptyForm = (): CampaignInput => ({
  name: '',
  objective: '',
  channel: '',
  status: 'draft',
  startDate: '',
  endDate: '',
});

const emptyPromo = (): PromotionInput => ({
  title: '',
  discountType: 'percent',
  discountValue: 0,
  startDate: '',
  endDate: '',
});

export function CampaignsView() {
  const t = useTranslations('campaigns');
  const tp = useTranslations('campaigns.promotions');
  const tc = useTranslations('common');

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CampaignInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Campaign | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promo, setPromo] = useState<PromotionInput>(emptyPromo());
  const [promoSaving, setPromoSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      setCampaigns(await listCampaigns());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(c: Campaign) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      objective: c.objective ?? '',
      channel: c.channel ?? '',
      status: c.status,
      startDate: c.startDate ?? '',
      endDate: c.endDate ?? '',
    });
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: CampaignInput = {
      name: form.name,
      objective: form.objective || undefined,
      channel: form.channel || undefined,
      status: form.status,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    };
    try {
      if (editingId) {
        await updateCampaign(editingId, payload);
      } else {
        await createCampaign(payload);
      }
      setShowForm(false);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await deleteCampaign(id);
      if (selected?.id === id) setSelected(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  async function selectCampaign(c: Campaign) {
    setSelected(c);
    setPromo(emptyPromo());
    try {
      setPromotions(await listPromotions(c.id));
    } catch {
      setPromotions([]);
    }
  }

  async function onAddPromo(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setPromoSaving(true);
    try {
      await createPromotion({
        title: promo.title,
        campaignId: selected.id,
        discountType: promo.discountType,
        discountValue: Number(promo.discountValue) || 0,
        startDate: promo.startDate || undefined,
        endDate: promo.endDate || undefined,
      });
      setPromo(emptyPromo());
      setPromotions(await listPromotions(selected.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setPromoSaving(false);
    }
  }

  async function onDeletePromo(id: number) {
    if (!window.confirm(tp('deleteConfirm'))) return;
    try {
      await deletePromotion(id);
      if (selected) setPromotions(await listPromotions(selected.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  const fmtDate = (d: string | null) => (d ? d : '—');
  const promoValue = (p: Promotion) =>
    p.discountType === 'percent'
      ? `${p.discountValue}%`
      : p.discountType === 'amount'
        ? `${p.discountValue.toLocaleString()} ฿`
        : tp('types.bundle');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('addCampaign')}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {editingId ? t('editCampaign') : t('newCampaign')}
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowForm(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cname">{t('name')}</Label>
                  <Input
                    id="cname"
                    required
                    placeholder={t('namePlaceholder')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t('status')}</Label>
                  <NativeSelect
                    id="status"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as CampaignStatus })
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`statusValues.${s}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objective">{t('objective')}</Label>
                  <Input
                    id="objective"
                    placeholder={t('objectivePlaceholder')}
                    value={form.objective ?? ''}
                    onChange={(e) => setForm({ ...form, objective: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel">{t('channel')}</Label>
                  <Input
                    id="channel"
                    placeholder={t('channelPlaceholder')}
                    value={form.channel ?? ''}
                    onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t('startDate')}</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={form.startDate ?? ''}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">{t('endDate')}</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={form.endDate ?? ''}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tc('save')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  {tc('cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              {t('empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('channel')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('startDate')}</TableHead>
                  <TableHead>{t('endDate')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow
                    key={c.id}
                    className={`cursor-pointer ${selected?.id === c.id ? 'bg-muted/60' : ''}`}
                    onClick={() => void selectCampaign(c)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.channel ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[c.status]}>
                        {t(`statusValues.${c.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(c.startDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(c.endDate)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(c.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Promotions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-gold" />
            {tp('title')}
            {selected && <span className="text-muted-foreground">· {selected.name}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selected ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              {tp('selectCampaign')}
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={onAddPromo} className="grid gap-3 md:grid-cols-12">
                <div className="space-y-2 md:col-span-5">
                  <Label htmlFor="ptitle">{tp('promoTitle')}</Label>
                  <Input
                    id="ptitle"
                    required
                    placeholder={tp('promoTitlePlaceholder')}
                    value={promo.title}
                    onChange={(e) => setPromo({ ...promo, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="ptype">{tp('discountType')}</Label>
                  <NativeSelect
                    id="ptype"
                    value={promo.discountType}
                    onChange={(e) =>
                      setPromo({ ...promo, discountType: e.target.value as DiscountType })
                    }
                  >
                    {DISCOUNT_TYPES.map((d) => (
                      <option key={d} value={d}>
                        {tp(`types.${d}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pvalue">{tp('discountValue')}</Label>
                  <Input
                    id="pvalue"
                    type="number"
                    min={0}
                    step="0.01"
                    value={promo.discountValue}
                    onChange={(e) =>
                      setPromo({ ...promo, discountValue: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex items-end md:col-span-2">
                  <Button type="submit" className="w-full" disabled={promoSaving}>
                    {promoSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {tp('add')}
                  </Button>
                </div>
              </form>

              {promotions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tp('empty')}</p>
              ) : (
                <ul className="space-y-2">
                  {promotions.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="warning">{promoValue(p)}</Badge>
                        <span className="font-medium">{p.title}</span>
                      </div>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onDeletePromo(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
