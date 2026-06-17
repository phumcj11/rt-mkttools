'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Save,
  Send,
  Sparkles,
  RefreshCw,
  Trash2,
  Calendar,
  Filter,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { SkuPromoStepSelector, type PromoAutoFill } from '@/features/promotions/promo-step-picker';
import { ApiError } from '@/lib/api';
import { fetchTemplates, fetchUsage, generateContent, generateContentBatch } from '@/lib/ai-api';
import {
  deleteContent,
  exportContentCsv,
  listContent,
  publishContentGbp,
  publishContentLine,
  saveContent,
  scheduleContent,
  updateContentStatus,
} from '@/lib/content-api';
import { getProductCatalogDetail } from '@/lib/products-api';
import type { ContentItem } from '@/lib/types';
import type {
  ContentTemplate,
  ContentTone,
  GenerateContentType,
  UsageSummary,
} from '@/lib/types';

const TONES: ContentTone[] = ['friendly', 'fun', 'professional', 'urgent'];

const GROUP_LABELS: Record<string, string> = {
  social:   'โซเชียลทั่วไป',
  platform: 'แยกตามแพลตฟอร์ม',
  seo:      'SEO & Long-form',
  tools:    'เครื่องมือ AI',
};

const TONE_LABELS: Record<ContentTone, string> = {
  friendly:     'เป็นกันเอง',
  fun:          'สนุกสนาน',
  professional: 'มืออาชีพ',
  urgent:       'เร่งด่วน',
};

const BATCH_TYPES: GenerateContentType[] = ['fb_post', 'tiktok_caption', 'line_broadcast'];

const STATUS_LABELS: Record<string, string> = {
  draft: 'แบบร่าง',
  approved: 'อนุมัติแล้ว',
  scheduled: 'ตั้งเวลา',
  published: 'เผยแพร่แล้ว',
};

export function ContentStudioView() {
  const locale = useLocale();
  const searchParams = useSearchParams();

  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  const [type, setType] = useState<GenerateContentType>('fb_post');
  const [sku, setSku] = useState(searchParams.get('sku') ?? '');
  const [productName, setProductName] = useState(searchParams.get('product') ?? '');
  const [price, setPrice] = useState(searchParams.get('price') ?? '');
  const [campaignId, setCampaignId] = useState<number | null>(
    searchParams.get('campaignId') ? Number(searchParams.get('campaignId')) : null,
  );
  const [campaignName, setCampaignName] = useState(searchParams.get('promo') ?? '');
  const [details, setDetails] = useState(
    searchParams.get('promo') ? `โปรโมชัน: ${searchParams.get('promo')}` : '',
  );
  const [tone, setTone] = useState<ContentTone>('friendly');

  const [result, setResult] = useState('');
  const [aiRequestId, setAiRequestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const [library, setLibrary] = useState<ContentItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedLibId, setCopiedLibId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  // Batch
  const [batchSkus, setBatchSkus] = useState('');
  const [batchTypes, setBatchTypes] = useState<GenerateContentType[]>(['fb_post', 'tiktok_caption']);
  const [batchCampaign, setBatchCampaign] = useState(searchParams.get('promo') ?? '');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<Array<{
    sku: string | null;
    productName: string;
    type: string;
    ok: boolean;
    content?: string;
    aiRequestId?: number;
    error?: string;
  }>>([]);
  const [batchSaving, setBatchSaving] = useState(false);

  const isToolType = (t: GenerateContentType) => ['rewrite', 'translate', 'hashtag'].includes(t);

  useEffect(() => {
    fetchTemplates()
      .then((list) => {
        setTemplates(list);
        if (list.length) {
          const first = list.find((l) => l.group === 'platform') ?? list[0];
          setType(first.key);
        }
      })
      .catch(() => undefined);
    refreshUsage();
    refreshLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = searchParams.get('sku');
    if (q && !productName) {
      getProductCatalogDetail(q)
        .then((p) => {
          setProductName(p.name);
          if (!price && p.retailPrice) setPrice(String(p.retailPrice));
        })
        .catch(() => undefined);
    }
  }, [searchParams, productName, price]);

  function refreshUsage() {
    fetchUsage().then(setUsage).catch(() => undefined);
  }

  function refreshLibrary() {
    setLibraryLoading(true);
    listContent()
      .then(setLibrary)
      .catch(() => undefined)
      .finally(() => setLibraryLoading(false));
  }

  const handleErpApply = useCallback((fill: PromoAutoFill) => {
    setSku(fill.sku);
    setPrice(String(fill.price));
    setCampaignId(fill.campaignId);
    setCampaignName(fill.campaignName);
    setDetails(`โปร ERP: ${fill.campaignName} — ${fill.stepText}`);
  }, []);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const res = await generateContent(
        {
          type,
          productName: productName || sku,
          price: price ? Number(price) : undefined,
          details: details || undefined,
          tone,
          locale,
        },
        locale,
      );
      setResult(res.content);
      setAiRequestId(res.aiRequestId);
      refreshUsage();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    try {
      await saveContent({
        type,
        body: result,
        locale,
        aiRequestId: aiRequestId ?? undefined,
        sku: sku || undefined,
        campaignId: campaignId ?? undefined,
        campaignName: campaignName || undefined,
        productName: productName || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      refreshLibrary();
    } catch { /* silent */ }
  }

  async function onCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function onDeleteLib(id: number) {
    setDeletingId(id);
    try {
      await deleteContent(id);
      setLibrary((prev) => prev.filter((c) => c.id !== id));
    } catch { /* silent */ }
    finally { setDeletingId(null); }
  }

  async function onCopyLib(item: ContentItem) {
    await navigator.clipboard.writeText(item.body ?? item.title ?? '');
    setCopiedLibId(item.id);
    setTimeout(() => setCopiedLibId(null), 1500);
  }

  async function onApprove(item: ContentItem) {
    setActionId(item.id);
    try {
      const updated = await updateContentStatus(item.id, 'approved');
      setLibrary((prev) => prev.map((c) => (c.id === item.id ? updated : c)));
    } catch { /* silent */ }
    finally { setActionId(null); }
  }

  async function onSchedule(item: ContentItem) {
    const raw = window.prompt('วันที่เผยแพร่ (YYYY-MM-DDTHH:mm)', new Date().toISOString().slice(0, 16));
    if (!raw) return;
    setActionId(item.id);
    try {
      const updated = await scheduleContent(item.id, new Date(raw).toISOString());
      setLibrary((prev) => prev.map((c) => (c.id === item.id ? updated : c)));
    } catch { /* silent */ }
    finally { setActionId(null); }
  }

  async function onPublishLine(item: ContentItem) {
    setActionId(item.id);
    try {
      const res = await publishContentLine(item.id);
      window.alert(res.message);
      if (res.ok) refreshLibrary();
    } catch { /* silent */ }
    finally { setActionId(null); }
  }

  async function onPublishGbp(item: ContentItem) {
    setActionId(item.id);
    try {
      const res = await publishContentGbp(item.id);
      window.alert(res.message);
      refreshLibrary();
    } catch { /* silent */ }
    finally { setActionId(null); }
  }

  async function onBatchGenerate() {
    const skuList = batchSkus
      .split(/[\n,]+/)
      .map((s) => s.replace(/\s+/g, '').toUpperCase())
      .filter(Boolean)
      .slice(0, 50);
    if (skuList.length === 0 || batchTypes.length === 0) return;

    setBatchLoading(true);
    setBatchResults([]);
    try {
      const products = await Promise.all(
        skuList.map(async (s) => {
          try {
            const p = await getProductCatalogDetail(s);
            return {
              sku: s,
              productName: p.name,
              price: p.retailPrice || undefined,
              details: p.promotionNames ? `โปร: ${p.promotionNames}` : undefined,
            };
          } catch {
            return { sku: s, productName: s };
          }
        }),
      );

      const res = await generateContentBatch(
        { products, types: batchTypes, tone, locale, campaignName: batchCampaign || undefined },
        locale,
      );
      setBatchResults(res.results);
      refreshUsage();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Batch generate ล้มเหลว');
    } finally {
      setBatchLoading(false);
    }
  }

  async function onSaveAllBatch() {
    const ok = batchResults.filter((r) => r.ok && r.content);
    if (ok.length === 0) return;
    setBatchSaving(true);
    try {
      await Promise.all(
        ok.map((r) =>
          saveContent({
            type: r.type,
            body: r.content!,
            locale,
            aiRequestId: r.aiRequestId,
            sku: r.sku ?? undefined,
            productName: r.productName,
            campaignName: batchCampaign || undefined,
          }),
        ),
      );
      refreshLibrary();
      setBatchResults([]);
    } catch { /* silent */ }
    finally { setBatchSaving(false); }
  }

  function onExportCsv() {
    const blob = new Blob([exportContentCsv(filteredLibrary)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const templateLabel = (tpl: ContentTemplate) => (locale === 'en' ? tpl.labelEn : tpl.labelTh);

  const grouped = templates.reduce<Record<string, ContentTemplate[]>>((acc, tpl) => {
    const g = tpl.group ?? 'social';
    if (!acc[g]) acc[g] = [];
    acc[g].push(tpl);
    return acc;
  }, {});

  const filteredLibrary = useMemo(
    () => (statusFilter === 'all' ? library : library.filter((c) => c.status === statusFilter)),
    [library, statusFilter],
  );

  const libraryGroups = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const item of filteredLibrary) {
      const key = item.sku || item.productName || 'อื่นๆ';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'th'));
  }, [filteredLibrary]);

  const toggleBatchType = (t: GenerateContentType) => {
    setBatchTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 5 ? [...prev, t] : prev,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">AI Content Factory</h1>
        <p className="text-muted-foreground">สร้างคอนเทนต์ Facebook, TikTok, Instagram, LINE, SEO — เชื่อม ERP SKU ได้</p>
        {usage && (
          <p className="text-xs text-muted-foreground">
            ใช้ไป {usage.totalTokens.toLocaleString()} / {usage.limit.toLocaleString()} tokens เดือนนี้
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-gold" />
              สร้างคอนเทนต์
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SkuPromoStepSelector
              initialSku={sku}
              label="SKU สินค้า (ดึงราคา + โปร ERP อัตโนมัติ)"
              onApply={(fill) => {
                handleErpApply(fill);
                getProductCatalogDetail(fill.sku)
                  .then((p) => setProductName(p.name))
                  .catch(() => undefined);
              }}
            />

            <form onSubmit={onGenerate} className="space-y-4">
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label>ประเภทคอนเทนต์</Label>
                <NativeSelect value={type} onChange={(e) => setType(e.target.value as GenerateContentType)}>
                  {Object.entries(grouped).map(([group, items]) => (
                    <optgroup key={group} label={GROUP_LABELS[group] ?? group}>
                      {items.map((tpl) => (
                        <option key={tpl.key} value={tpl.key}>{templateLabel(tpl)}</option>
                      ))}
                    </optgroup>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label>
                  {isToolType(type) ? 'หัวข้อ / ชื่อสินค้า' : 'ชื่อสินค้า'}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  required
                  placeholder="เช่น ยาดมตราหอยทาก"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
                {sku && <p className="text-xs text-muted-foreground font-mono">SKU: {sku}</p>}
              </div>

              {!isToolType(type) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>ราคา (บาท)</Label>
                    <Input type="number" min={0} placeholder="100" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>โทนการเขียน</Label>
                    <NativeSelect value={tone} onChange={(e) => setTone(e.target.value as ContentTone)}>
                      {TONES.map((v) => (
                        <option key={v} value={v}>{TONE_LABELS[v]}</option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
              )}

              {campaignName && (
                <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
                  Campaign: <strong>{campaignName}</strong>
                </div>
              )}

              <div className="space-y-2">
                <Label>{isToolType(type) ? 'คอนเทนต์ที่ต้องการประมวลผล *' : 'รายละเอียดเพิ่มเติม'}</Label>
                <Textarea
                  rows={isToolType(type) ? 5 : 3}
                  required={isToolType(type)}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> AI กำลังเขียน...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> สร้างคอนเทนต์</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">ผลลัพธ์</CardTitle>
            {result && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="default" size="sm" onClick={onSave}>
                  {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saved ? 'บันทึกแล้ว' : 'บันทึก'}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-[320px]"
              placeholder="คอนเทนต์ที่สร้างจะแสดงที่นี่..."
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Batch Generate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Batch Generate
            <Badge variant="outline" className="ml-2 text-xs">สูงสุด 50 SKU</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>SKU (หนึ่งบรรทัดต่อหนึ่ง SKU หรือคั่นด้วย comma)</Label>
              <Textarea
                rows={5}
                placeholder={'RT20787\nRT20788\nRT20789'}
                value={batchSkus}
                onChange={(e) => setBatchSkus(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>ชื่อ Campaign (optional)</Label>
                <Input value={batchCampaign} onChange={(e) => setBatchCampaign(e.target.value)} placeholder="Buffet 100" />
              </div>
              <div className="space-y-2">
                <Label>แพลตฟอร์ม (เลือกได้สูงสุด 5)</Label>
                <div className="flex flex-wrap gap-2">
                  {BATCH_TYPES.map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => toggleBatchType(bt)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        batchTypes.includes(bt)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted-foreground/30 text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={onBatchGenerate} disabled={batchLoading || batchSkus.trim().length === 0} className="w-full">
                {batchLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังสร้าง...</>
                ) : (
                  'สร้าง Batch'
                )}
              </Button>
            </div>
          </div>

          {batchResults.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  ผลลัพธ์ {batchResults.filter((r) => r.ok).length}/{batchResults.length} สำเร็จ
                </p>
                <Button size="sm" onClick={onSaveAllBatch} disabled={batchSaving}>
                  {batchSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                  บันทึกทั้งหมดลงคลัง
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {batchResults.map((r, i) => (
                  <div key={i} className={`rounded border px-2 py-1.5 text-xs ${r.ok ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                    <span className="font-mono">{r.sku ?? '—'}</span> · {r.type} · {r.productName}
                    {r.ok ? <CheckCircle2 className="inline ml-1 h-3 w-3 text-green-600" /> : ` — ${r.error}`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Library */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" />
              คลังคอนเทนต์
              {library.length > 0 && (
                <span className="text-muted-foreground font-normal text-sm">({library.length})</span>
              )}
            </CardTitle>
            <div className="ml-auto flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <NativeSelect
                className="h-8 text-xs w-auto"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">ทุกสถานะ</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </NativeSelect>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onExportCsv} disabled={filteredLibrary.length === 0}>
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refreshLibrary} disabled={libraryLoading}>
                <RefreshCw className={`h-3.5 w-3.5 ${libraryLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {libraryLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
            </div>
          ) : filteredLibrary.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีคอนเทนต์ — สร้างแล้วกด &quot;บันทึก&quot;</p>
          ) : (
            <div className="space-y-4">
              {libraryGroups.map(([groupKey, items]) => (
                <div key={groupKey}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    {groupKey} ({items.length})
                  </p>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{STATUS_LABELS[item.status] ?? item.status}</Badge>
                            {item.campaignName && (
                              <span className="text-[10px] text-amber-700 truncate">{item.campaignName}</span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-2">{item.body ?? item.title}</p>
                          {item.scheduledAt && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              <Calendar className="inline h-3 w-3 mr-0.5" />
                              {new Date(item.scheduledAt).toLocaleString('th-TH')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void onCopyLib(item)}>
                              {copiedLibId === item.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={deletingId === item.id} onClick={() => void onDeleteLib(item.id)}>
                              {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                            </Button>
                          </div>
                          {item.status === 'draft' && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={actionId === item.id} onClick={() => void onApprove(item)}>
                              อนุมัติ
                            </Button>
                          )}
                          {['draft', 'approved'].includes(item.status) && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={actionId === item.id} onClick={() => void onSchedule(item)}>
                              ตั้งเวลา
                            </Button>
                          )}
                          {item.type === 'line_broadcast' && item.status !== 'published' && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={actionId === item.id} onClick={() => void onPublishLine(item)}>
                              <Send className="h-3 w-3 mr-0.5" /> LINE
                            </Button>
                          )}
                          {item.type === 'gbp_post' && item.status !== 'published' && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={actionId === item.id} onClick={() => void onPublishGbp(item)}>
                              GBP
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
