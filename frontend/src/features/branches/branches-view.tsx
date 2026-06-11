'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  createBranch,
  deleteBranch,
  listBranches,
  updateBranch,
} from '@/lib/branches-api';
import type { Branch, BranchInput, BranchStatus } from '@/lib/types';

const STATUSES: BranchStatus[] = ['active', 'inactive'];

const emptyForm = (): BranchInput => ({
  name: '',
  code: '',
  address: '',
  phone: '',
  status: 'active',
});

export function BranchesView() {
  const t = useTranslations('branches');
  const tc = useTranslations('common');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BranchInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const b = await listBranches();
      setBranches(b);
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

  function openEdit(b: Branch) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      code: b.code ?? '',
      address: b.address ?? '',
      phone: b.phone ?? '',
      status: b.status,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: BranchInput = {
      name: form.name,
      code: form.code || undefined,
      address: form.address || undefined,
      phone: form.phone || undefined,
      status: form.status,
    };
    try {
      if (editingId) {
        await updateBranch(editingId, payload);
      } else {
        await createBranch(payload);
      }
      closeForm();
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
      await deleteBranch(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('addBranch')}
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
              {editingId ? t('editBranch') : t('newBranch')}
            </CardTitle>
            <Button type="button" variant="ghost" size="icon" onClick={closeForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('name')}</Label>
                  <Input
                    id="name"
                    required
                    placeholder={t('namePlaceholder')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">{t('code')}</Label>
                  <Input
                    id="code"
                    placeholder={t('codePlaceholder')}
                    value={form.code ?? ''}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('phone')}</Label>
                  <Input
                    id="phone"
                    placeholder={t('phonePlaceholder')}
                    value={form.phone ?? ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t('status')}</Label>
                  <NativeSelect
                    id="status"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as BranchStatus })
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`statusValues.${s}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">{t('address')}</Label>
                  <Input
                    id="address"
                    placeholder={t('addressPlaceholder')}
                    value={form.address ?? ''}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tc('save')}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>
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
          ) : branches.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
              <Building2 className="h-8 w-8 text-muted-foreground/50" />
              {t('empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('code')}</TableHead>
                  <TableHead>{t('phone')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.code ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{b.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === 'active' ? 'success' : 'muted'}>
                        {t(`statusValues.${b.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(b)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(b.id)}
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
    </div>
  );
}
