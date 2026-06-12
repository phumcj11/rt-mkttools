'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, Check, Copy, Loader2, Save, Sparkles, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { fetchTemplates, fetchUsage, generateContent } from '@/lib/ai-api';
import { listContent, saveContent, deleteContent } from '@/lib/content-api';
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

export function ContentStudioView() {
  const t = useTranslations('studio');
  const locale = useLocale();
  const searchParams = useSearchParams();

  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  const [type, setType] = useState<GenerateContentType>('fb_post');
  const [productName, setProductName] = useState(searchParams.get('product') ?? '');
  const [price, setPrice] = useState(searchParams.get('price') ?? '');
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedLibId, setCopiedLibId] = useState<number | null>(null);

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

  function refreshUsage() {
    fetchUsage()
      .then(setUsage)
      .catch(() => undefined);
  }

  function refreshLibrary() {
    setLibraryLoading(true);
    listContent()
      .then(setLibrary)
      .catch(() => undefined)
      .finally(() => setLibraryLoading(false));
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const res = await generateContent(
        { type, productName, price: price ? Number(price) : undefined, details: details || undefined, tone, locale },
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

  async function onCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function onSave() {
    try {
      await saveContent({ type, body: result, locale, aiRequestId: aiRequestId ?? undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      refreshLibrary();
    } catch { /* silent */ }
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

  const templateLabel = (tpl: ContentTemplate) => (locale === 'en' ? tpl.labelEn : tpl.labelTh);

  const grouped = templates.reduce<Record<string, ContentTemplate[]>>((acc, tpl) => {
    const g = tpl.group ?? 'social';
    if (!acc[g]) acc[g] = [];
    acc[g].push(tpl);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">AI Content Factory</h1>
        <p className="text-muted-foreground">สร้างคอนเทนต์ Facebook, TikTok, Instagram, LINE, SEO และอื่น ๆ ด้วย AI</p>
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
          <CardContent>
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
              </div>

              {!isToolType(type) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>ราคา (บาท)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="100"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
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

              <div className="space-y-2">
                <Label>
                  {isToolType(type) ? 'คอนเทนต์ที่ต้องการประมวลผล *' : 'รายละเอียดเพิ่มเติม'}
                </Label>
                <Textarea
                  rows={isToolType(type) ? 5 : 3}
                  required={isToolType(type)}
                  placeholder={
                    type === 'rewrite' ? 'วางคอนเทนต์เดิมที่ต้องการ rewrite ที่นี่...' :
                    type === 'translate' ? 'วางข้อความที่ต้องการแปลที่นี่...' :
                    type === 'hashtag' ? 'บอกเพิ่มเติมเกี่ยวกับสินค้า กลุ่มเป้าหมาย...' :
                    'จุดเด่น โปรโมชั่น หรือกลุ่มลูกค้า (ไม่บังคับ)'
                  }
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
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
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

      {/* Content Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            คลังคอนเทนต์
            {library.length > 0 && (
              <span className="text-muted-foreground font-normal text-sm">({library.length})</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7"
              onClick={refreshLibrary}
              disabled={libraryLoading}
              title="รีเฟรช"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${libraryLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {libraryLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
            </div>
          ) : library.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีคอนเทนต์ที่บันทึก — สร้างแล้วกด &quot;บันทึก&quot; จะปรากฏที่นี่</p>
          ) : (
            <div className="space-y-2">
              {library.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-[10px] shrink-0">{item.type}</Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        {new Date(item.createdAt).toLocaleString('th-TH', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">{item.body ?? item.title}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="คัดลอก"
                      onClick={() => void onCopyLib(item)}
                    >
                      {copiedLibId === item.id
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="ลบ"
                      disabled={deletingId === item.id}
                      onClick={() => void onDeleteLib(item.id)}
                    >
                      {deletingId === item.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Batch Generate</p>
              <p className="text-xs text-muted-foreground">สร้างคอนเทนต์หลายชิ้นพร้อมกันจาก CSV รายการสินค้า — พัฒนาต่อเนื่อง</p>
            </div>
            <Badge variant="outline" className="ml-auto shrink-0 text-xs">เร็ว ๆ นี้</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
