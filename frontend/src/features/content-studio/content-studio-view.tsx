'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Copy, Loader2, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { fetchTemplates, fetchUsage, generateContent } from '@/lib/ai-api';
import { saveContent } from '@/lib/content-api';
import type {
  ContentTemplate,
  ContentTone,
  GenerateContentType,
  UsageSummary,
} from '@/lib/types';

const TONES: ContentTone[] = ['friendly', 'fun', 'professional', 'urgent'];

export function ContentStudioView() {
  const t = useTranslations('studio');
  const locale = useLocale();

  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  const [type, setType] = useState<GenerateContentType>('caption');
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [details, setDetails] = useState('');
  const [tone, setTone] = useState<ContentTone>('friendly');

  const [result, setResult] = useState('');
  const [aiRequestId, setAiRequestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchTemplates()
      .then((list) => {
        setTemplates(list);
        if (list.length) setType(list[0].key);
      })
      .catch(() => undefined);
    refreshUsage();
  }, []);

  function refreshUsage() {
    fetchUsage()
      .then(setUsage)
      .catch(() => undefined);
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const res = await generateContent(
        {
          type,
          productName,
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
      setError(err instanceof ApiError ? err.message : t('generating'));
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
      await saveContent({
        type,
        body: result,
        locale,
        aiRequestId: aiRequestId ?? undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // เงียบไว้ — แสดง error หลักไว้ที่ generate
    }
  }

  const templateLabel = (tpl: ContentTemplate) => (locale === 'en' ? tpl.labelEn : tpl.labelTh);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
        {usage && (
          <p className="text-xs text-muted-foreground">
            {t('tokensUsed', {
              used: usage.totalTokens.toLocaleString(),
              limit: usage.limit.toLocaleString(),
            })}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-gold" />
              {t('generate')}
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
                <Label htmlFor="type">{t('contentType')}</Label>
                <NativeSelect
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as GenerateContentType)}
                >
                  {templates.map((tpl) => (
                    <option key={tpl.key} value={tpl.key}>
                      {templateLabel(tpl)}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productName">{t('productName')}</Label>
                <Input
                  id="productName"
                  required
                  placeholder={t('productNamePlaceholder')}
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="price">{t('price')}</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    placeholder={t('pricePlaceholder')}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tone">{t('tone')}</Label>
                  <NativeSelect
                    id="tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as ContentTone)}
                  >
                    {TONES.map((value) => (
                      <option key={value} value={value}>
                        {t(`tones.${value}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="details">{t('details')}</Label>
                <Textarea
                  id="details"
                  rows={3}
                  placeholder={t('detailsPlaceholder')}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t('generate')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Output */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('result')}</CardTitle>
            {result && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('copied') : t('copy')}
                </Button>
                <Button type="button" variant="gold" size="sm" onClick={onSave}>
                  {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saved ? t('saved') : t('save')}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-[320px]"
              placeholder={t('resultPlaceholder')}
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
