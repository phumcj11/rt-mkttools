'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Download,
  FileImage,
  ImagePlus,
  Layers,
  Loader2,
  Megaphone,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generatePosm, listPosm, deletePosm } from '@/lib/posm-api';
import type { GeneratePosmResult, PosmProject } from '@/lib/posm-api';
import { SkuPromoStepSelector } from '@/features/promotions/promo-step-picker';

const POSM_TYPES = [
  { id: 'price_tag',     label: 'ป้ายราคา',             icon: Tag },
  { id: 'shelf_talker',  label: 'Shelf Talker',         icon: Layers },
  { id: 'wobbler',       label: 'Wobbler',              icon: FileImage },
  { id: 'promotion_a4',  label: 'โปสเตอร์ A4',          icon: ImagePlus },
  { id: 'review_poster', label: 'Google Review Poster', icon: Sparkles },
  { id: 'sale_tag',      label: 'ป้ายลดราคา',            icon: Megaphone },
];

/* ─── Per-type template styles ───────────────────────────────────────────── */
function PosmTemplate({ result, type }: { result: GeneratePosmResult; type: string }) {
  const brand = '100 Baht Shop Thailand';

  if (type === 'price_tag') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6">
        <div className="text-xs font-semibold tracking-widest text-white/80 uppercase">Price</div>
        <div className="text-6xl font-black text-white drop-shadow">฿{result.price ?? '-'}</div>
        <div className="mt-1 text-xl font-bold text-white text-center">{result.productName}</div>
        {result.promotion && (
          <div className="mt-2 rounded-full bg-yellow-400 px-4 py-1 text-sm font-bold text-black">
            {result.promotion}
          </div>
        )}
        <div className="mt-3 text-[10px] text-white/60">{brand}</div>
      </div>
    );
  }

  if (type === 'shelf_talker') {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-white/20 py-2 text-center text-xs font-semibold tracking-widest text-white uppercase">
          {brand}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5">
          {result.headline && (
            <div className="text-center text-lg font-extrabold text-yellow-300">{result.headline}</div>
          )}
          <div className="text-center text-2xl font-bold text-white">{result.productName}</div>
          <div className="text-4xl font-black text-white">฿{result.price ?? '-'}</div>
          {result.promotion && (
            <Badge className="bg-yellow-400 text-black text-sm px-3">{result.promotion}</Badge>
          )}
        </div>
      </div>
    );
  }

  if (type === 'wobbler') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-5">
        <div className="rounded-full bg-yellow-400 p-4 shadow-lg">
          <div className="text-4xl font-black text-black">฿{result.price ?? '-'}</div>
        </div>
        <div className="text-center text-xl font-bold text-white">{result.productName}</div>
        {result.headline && (
          <div className="text-center text-sm font-semibold text-yellow-300">{result.headline}</div>
        )}
        {result.promotion && (
          <div className="rounded border-2 border-yellow-400 px-3 py-1 text-sm font-bold text-yellow-300">
            {result.promotion}
          </div>
        )}
        <div className="text-[10px] text-white/60">{brand}</div>
      </div>
    );
  }

  if (type === 'promotion_a4') {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-yellow-400 py-3 text-center">
          <div className="text-sm font-extrabold text-black uppercase tracking-wider">{brand}</div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          {result.headline && (
            <div className="text-center text-2xl font-extrabold text-yellow-300">{result.headline}</div>
          )}
          <div className="text-center text-3xl font-bold text-white">{result.productName}</div>
          <div className="text-5xl font-black text-yellow-400">฿{result.price ?? '-'}</div>
          {result.promotion && (
            <div className="rounded-lg bg-white/20 border border-white/40 px-5 py-2 text-center text-lg font-bold text-white">
              {result.promotion}
            </div>
          )}
        </div>
        <div className="py-2 text-center text-[10px] text-white/50">www.100bathshop.com</div>
      </div>
    );
  }

  if (type === 'review_poster') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-5">
        <div className="text-3xl">⭐⭐⭐⭐⭐</div>
        <div className="text-center text-xl font-extrabold text-white">
          {result.headline ?? 'รีวิวจากลูกค้า'}
        </div>
        <div className="text-center text-base font-semibold text-yellow-300">{result.productName}</div>
        {result.promotion && (
          <div className="text-center text-sm text-white/80 italic">&ldquo;{result.promotion}&rdquo;</div>
        )}
        <div className="mt-2 text-xs text-white/60">{brand}</div>
      </div>
    );
  }

  /* sale_tag (default) */
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 p-5">
      <div className="rounded-full bg-red-500 px-5 py-1 text-sm font-extrabold text-white uppercase tracking-widest">
        Sale
      </div>
      <div className="text-5xl font-black text-yellow-400">฿{result.price ?? '-'}</div>
      <div className="text-center text-xl font-bold text-white">{result.productName}</div>
      {result.headline && (
        <div className="text-center text-sm font-semibold text-white/80">{result.headline}</div>
      )}
      {result.promotion && (
        <Badge className="bg-yellow-400 text-black">{result.promotion}</Badge>
      )}
      <div className="mt-2 text-[10px] text-white/60">{brand}</div>
    </div>
  );
}

/* ─── bg gradient per type ───────────────────────────────────────────────── */
const TYPE_BG: Record<string, string> = {
  price_tag:     'from-primary to-blue-900',
  shelf_talker:  'from-emerald-700 to-emerald-950',
  wobbler:       'from-purple-700 to-purple-950',
  promotion_a4:  'from-rose-700 to-rose-950',
  review_poster: 'from-amber-600 to-amber-900',
  sale_tag:      'from-red-700 to-gray-900',
};

export function PosmView() {
  const searchParams = useSearchParams();
  const previewRef = useRef<HTMLDivElement>(null);

  const [selectedType, setSelectedType] = useState(POSM_TYPES[0].id);
  const [productName, setProductName] = useState(searchParams.get('product') ?? '');
  const [price, setPrice] = useState(searchParams.get('price') ?? '');
  const [promotion, setPromotion] = useState(searchParams.get('promo') ?? '');
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<GeneratePosmResult | null>(null);
  const [history, setHistory] = useState<PosmProject[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPosm().then(setHistory).catch(() => null);
  }, []);

  const handleGenerate = async () => {
    if (!productName || !price) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await generatePosm({
        type: selectedType,
        productName,
        price: Number(price),
        promotion: promotion || undefined,
      });
      setResult(data);
      setHistory((prev) => [data, ...prev].slice(0, 20));
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deletePosm(id).catch(() => null);
    setHistory((prev) => prev.filter((p) => p.id !== id));
    if (result?.id === id) setResult(null);
  };

  const handleDownloadPng = async () => {
    if (!previewRef.current || !result) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 3 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `posm-${result.id}-${selectedType}.png`;
      a.click();
    } catch {
      alert('ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!previewRef.current || !result) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 2 });
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(
        `<html><body style="margin:0"><img src="${dataUrl}" style="max-width:100%;display:block"/></body></html>`
      );
      win.document.close();
      win.focus();
      win.print();
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const bg = TYPE_BG[selectedType] ?? 'from-primary to-blue-900';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI POSM Generator</h1>
        <p className="text-muted-foreground">
          สร้างสื่อ ณ จุดขาย (Point of Sale Materials) ด้วย AI — ป้ายราคา, โปสเตอร์, Shelf Talker และอื่น ๆ
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">เลือกประเภท POSM</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {POSM_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                        selectedType === type.id
                          ? 'border-primary bg-primary/5 text-primary font-semibold'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ข้อมูลสินค้า</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SkuPromoStepSelector
                label="ค้น SKU เพื่อดึงราคาโปรจาก ERP (ไม่บังคับ)"
                onApply={(fill) => {
                  if (!productName) setProductName(fill.sku);
                  setPrice(String(Math.round(fill.price)));
                  setPromotion(fill.stepText);
                }}
              />
              <div className="space-y-1.5">
                <Label>ชื่อสินค้า *</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="เช่น ยาดมตราหอยทาก"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ราคา (บาท) *</Label>
                  <Input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="100"
                    type="number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>โปรโมชั่น</Label>
                  <Input
                    value={promotion}
                    onChange={(e) => setPromotion(e.target.value)}
                    placeholder="เช่น ซื้อ 2 แถม 1"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={() => void handleGenerate()}
                disabled={!productName || !price || generating}
              >
                {generating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังสร้าง POSM...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />สร้าง POSM ด้วย AI</>
                )}
              </Button>
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ประวัติล่าสุด</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{p.productName}</span>
                      {p.price != null && <span className="ml-2 text-muted-foreground">฿{p.price}</span>}
                      <Badge variant="outline" className="ml-2 text-xs">{p.type}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void handleDelete(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preview panel */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileImage className="h-4 w-4" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-3">
                  {result.headline && (
                    <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                      <p className="text-xs font-semibold text-primary flex items-center gap-1 mb-1">
                        <Sparkles className="h-3 w-3" /> AI Headline
                      </p>
                      <p className="text-sm font-medium">{result.headline}</p>
                    </div>
                  )}

                  {/* Capturable template */}
                  <div
                    ref={previewRef}
                    className={`flex aspect-[3/4] rounded-xl bg-gradient-to-br ${bg} overflow-hidden`}
                  >
                    <PosmTemplate result={result} type={selectedType} />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={downloading}
                      onClick={() => void handleDownloadPng()}
                    >
                      {downloading ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-3.5 w-3.5" />
                      )}
                      PNG
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={downloading}
                      onClick={() => void handlePrint()}
                    >
                      <FileImage className="mr-2 h-3.5 w-3.5" />
                      PDF / Print
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={`flex aspect-[3/4] items-center justify-center rounded-xl bg-gradient-to-br ${bg}`}>
                  <p className="text-center text-sm text-white/60 px-4">
                    กรอกข้อมูลสินค้าและกด &ldquo;สร้าง POSM&rdquo; เพื่อดู Preview
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
