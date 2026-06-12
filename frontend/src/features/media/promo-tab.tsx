'use client';

import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  Download,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  generatePromoFeatures,
  proxyImageUrl,
  resolveMediaUrl,
  savePromoImage,
  type ErpProduct,
} from '@/lib/media-api';
import {
  emptyPromoData,
  getPromoDimensions,
  PromoTemplateRenderer,
  PROMO_OPTIONS,
  type BundleDealData,
  type BuyXGetYData,
  type ClearanceSaleData,
  type NewArrivalData,
  type PromoData,
  type PromoType,
  type SpendFreeGiftData,
} from './promo-templates';

// ---------------------------------------------------------------------------
// Product picker helper
// ---------------------------------------------------------------------------

function ProductPicker({
  label,
  products,
  selectedSku,
  onChange,
}: {
  label: string;
  products: ErpProduct[];
  selectedSku: string;
  onChange: (imageUrl: string, sku: string, name: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={selectedSku}
        onChange={(e) => {
          const p = products.find((x) => x.sku === e.target.value);
          if (p) onChange(proxyImageUrl(p.imageUrl), p.sku, p.name);
        }}
      >
        <option value="">-- เลือกสินค้า --</option>
        {products.map((p) => (
          <option key={p.sku} value={p.sku}>
            {p.name} ({p.sku})
          </option>
        ))}
      </select>
    </div>
  );
}

function TextF({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-template forms
// ---------------------------------------------------------------------------

function SpendFreeGiftForm({
  data,
  setData,
  products,
}: {
  data: SpendFreeGiftData;
  setData: (d: SpendFreeGiftData) => void;
  products: ErpProduct[];
}) {
  const [sku, setSku] = useState('');
  return (
    <div className="space-y-3">
      <ProductPicker
        label="รูปสินค้า (Product Image)"
        products={products}
        selectedSku={sku}
        onChange={(imageUrl, s) => { setSku(s); setData({ ...data, productImage: imageUrl }); }}
      />
      <TextF label="ยอดซื้อขั้นต่ำ (Spend Amount) — ตัวเลขเท่านั้น" value={data.spendAmount}
        onChange={(v) => setData({ ...data, spendAmount: v })} placeholder="เช่น 299" />
      <div className="space-y-1">
        <Label className="text-xs">ของแถม (Free Gift)</Label>
        <Textarea value={data.freeGift}
          onChange={(e) => setData({ ...data, freeGift: e.target.value })}
          placeholder="เช่น กระเป๋าผ้าสุดน่ารัก 1 ใบ" rows={2} className="text-sm" />
      </div>
      <TextF label="วันหมดเขต (Valid Date)" value={data.validDate}
        onChange={(v) => setData({ ...data, validDate: v })} placeholder="เช่น 30 มิ.ย. 2569" />
    </div>
  );
}

function BuyXGetYForm({
  data,
  setData,
  products,
}: {
  data: BuyXGetYData;
  setData: (d: BuyXGetYData) => void;
  products: ErpProduct[];
}) {
  const [mainSku, setMainSku] = useState('');
  const [buySku, setBuySku] = useState('');
  const [getSku, setGetSku] = useState('');
  return (
    <div className="space-y-3">
      <ProductPicker label="รูปสินค้าหลัก (ซ้าย)" products={products} selectedSku={mainSku}
        onChange={(imageUrl, s) => { setMainSku(s); setData({ ...data, mainProductImage: imageUrl }); }} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 border rounded-md p-2">
          <p className="text-xs font-semibold text-red-600">BUY (ซื้อ)</p>
          <ProductPicker label="สินค้า BUY" products={products} selectedSku={buySku}
            onChange={(imageUrl, s, name) => { setBuySku(s); setData({ ...data, buyProductImage: imageUrl, buyProductName: name }); }} />
          <TextF label="ชื่อ BUY" value={data.buyProductName}
            onChange={(v) => setData({ ...data, buyProductName: v })} placeholder="ชื่อสินค้าที่ต้องซื้อ" />
        </div>
        <div className="space-y-2 border rounded-md p-2">
          <p className="text-xs font-semibold text-red-600">GET (รับฟรี)</p>
          <ProductPicker label="สินค้า GET" products={products} selectedSku={getSku}
            onChange={(imageUrl, s, name) => { setGetSku(s); setData({ ...data, getProductImage: imageUrl, getProductName: name }); }} />
          <TextF label="ชื่อ GET" value={data.getProductName}
            onChange={(v) => setData({ ...data, getProductName: v })} placeholder="ชื่อของที่ได้ฟรี" />
        </div>
      </div>
      <TextF label="วันหมดเขต" value={data.validDate}
        onChange={(v) => setData({ ...data, validDate: v })} placeholder="เช่น 30 มิ.ย. 2569" />
    </div>
  );
}

function BundleDealForm({
  data,
  setData,
  products,
}: {
  data: BundleDealData;
  setData: (d: BundleDealData) => void;
  products: ErpProduct[];
}) {
  const [sku1, setSku1] = useState('');
  const [sku2, setSku2] = useState('');
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <ProductPicker label="สินค้า 1" products={products} selectedSku={sku1}
            onChange={(imageUrl, s, name) => { setSku1(s); setData({ ...data, product1Image: imageUrl, product1Name: name }); }} />
          <TextF label="ชื่อสินค้า 1" value={data.product1Name}
            onChange={(v) => setData({ ...data, product1Name: v })} />
        </div>
        <div className="space-y-2">
          <ProductPicker label="สินค้า 2" products={products} selectedSku={sku2}
            onChange={(imageUrl, s, name) => { setSku2(s); setData({ ...data, product2Image: imageUrl, product2Name: name }); }} />
          <TextF label="ชื่อสินค้า 2" value={data.product2Name}
            onChange={(v) => setData({ ...data, product2Name: v })} />
        </div>
      </div>
      <TextF label='ราคา Bundle "ONLY X THB"' value={data.bundlePrice}
        onChange={(v) => setData({ ...data, bundlePrice: v })} placeholder="เช่น 199" />
      <TextF label="ของแถมฟรี (FREE)" value={data.freeGiftName ?? ''}
        onChange={(v) => setData({ ...data, freeGiftName: v })} placeholder="เช่น ถุงผ้า" />
      <TextF label="วันหมดเขต" value={data.validDate}
        onChange={(v) => setData({ ...data, validDate: v })} placeholder="เช่น 30 มิ.ย. 2569" />
    </div>
  );
}

function NewArrivalForm({
  data,
  setData,
  products,
}: {
  data: NewArrivalData;
  setData: (d: NewArrivalData) => void;
  products: ErpProduct[];
}) {
  const [sku, setSku] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleAiFeatures = async () => {
    if (!selectedSku) { alert('เลือกสินค้าก่อน แล้วกด AI Generate'); return; }
    setAiLoading(true);
    try {
      const res = await generatePromoFeatures(selectedSku);
      setData({ ...data, feature1: res.feature1, feature2: res.feature2, feature3: res.feature3 });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'AI generate ล้มเหลว');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <ProductPicker label="รูปสินค้า" products={products} selectedSku={sku}
        onChange={(imageUrl, s) => { setSku(s); setSelectedSku(s); setData({ ...data, productImage: imageUrl }); }} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">จุดเด่น 3 ข้อ (Feature Boxes)</p>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
          onClick={() => void handleAiFeatures()} disabled={aiLoading}>
          {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          AI Generate Features
        </Button>
      </div>
      <TextF label="Feature 1" value={data.feature1}
        onChange={(v) => setData({ ...data, feature1: v })} placeholder="เช่น สินค้าใหม่ ล่าสุด" />
      <TextF label="Feature 2" value={data.feature2}
        onChange={(v) => setData({ ...data, feature2: v })} placeholder="เช่น คุณภาพดี ใช้ทน" />
      <TextF label="Feature 3" value={data.feature3}
        onChange={(v) => setData({ ...data, feature3: v })} placeholder="เช่น ราคาคุ้มค่า ฿100" />
      <TextF label="วันหมดเขต" value={data.validDate}
        onChange={(v) => setData({ ...data, validDate: v })} placeholder="เช่น 30 มิ.ย. 2569" />
    </div>
  );
}

function ClearanceSaleForm({
  data,
  setData,
  products,
}: {
  data: ClearanceSaleData;
  setData: (d: ClearanceSaleData) => void;
  products: ErpProduct[];
}) {
  const [mainSku, setMainSku] = useState('');
  const [smallSkus, setSmallSkus] = useState(['', '', '']);

  const updateProduct = (i: number, imageUrl: string, name: string, sku: string) => {
    const updated = [...data.products];
    updated[i] = { ...updated[i], image: imageUrl, name };
    const newSkus = [...smallSkus]; newSkus[i] = sku; setSmallSkus(newSkus);
    setData({ ...data, products: updated });
  };
  const updateProductField = (i: number, field: string, value: string) => {
    const updated = [...data.products];
    updated[i] = { ...updated[i], [field]: value };
    setData({ ...data, products: updated });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <ProductPicker label="สินค้าหลัก (ซ้าย)" products={products} selectedSku={mainSku}
          onChange={(imageUrl, s, name) => { setMainSku(s); setData({ ...data, mainProductImage: imageUrl, mainProductName: name }); }} />
        <TextF label="ชื่อสินค้าหลัก" value={data.mainProductName}
          onChange={(v) => setData({ ...data, mainProductName: v })} />
      </div>
      <TextF label='ลดสูงสุด "UP TO X% OFF"' value={data.discountPercent}
        onChange={(v) => setData({ ...data, discountPercent: v })} placeholder="เช่น 50" />

      <p className="text-xs font-semibold text-muted-foreground pt-1">สินค้า SPECIAL PRICE (3 ช่อง)</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border rounded-md p-2 space-y-2">
          <p className="text-xs font-semibold">สินค้า {i + 1}</p>
          <ProductPicker label={`รูปสินค้า ${i + 1}`} products={products} selectedSku={smallSkus[i]}
            onChange={(imageUrl, s, name) => updateProduct(i, imageUrl, name, s)} />
          <div className="grid grid-cols-3 gap-2">
            <TextF label="ชื่อ" value={data.products[i]?.name ?? ''}
              onChange={(v) => updateProductField(i, 'name', v)} />
            <TextF label="ราคา" value={data.products[i]?.price ?? ''}
              onChange={(v) => updateProductField(i, 'price', v)} placeholder="฿" />
            <TextF label="ลด %" value={data.products[i]?.savePercent ?? ''}
              onChange={(v) => updateProductField(i, 'savePercent', v)} placeholder="%" />
          </div>
        </div>
      ))}
      <TextF label="วันหมดเขต" value={data.validDate}
        onChange={(v) => setData({ ...data, validDate: v })} placeholder="เช่น 30 มิ.ย. 2569" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main PromoTab component
// ---------------------------------------------------------------------------

/** Wait for all img elements inside root to finish loading before capture */
function waitForImages(root: HTMLElement, timeoutMs = 8000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, timeoutMs);
        }),
    ),
  ).then(() => undefined);
}

export function PromoTab({ products }: { products: ErpProduct[] }) {
  const [promoType, setPromoType] = useState<PromoType>('spend_free_gift');
  const [promoData, setPromoData] = useState<PromoData>(() => emptyPromoData('spend_free_gift'));
  const [saving, setSaving] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);

  const promoRef = useRef<HTMLDivElement>(null);
  const [promoRender, setPromoRender] = useState<{
    type: PromoType;
    data: PromoData;
    resolve: (url: string) => void;
    reject: (err: Error) => void;
  } | null>(null);

  /** Off-screen capture effect */
  useEffect(() => {
    if (!promoRender || !promoRef.current) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await waitForImages(promoRef.current!);
          const { width, height } = getPromoDimensions(promoRender.type);
          const dataUrl = await toPng(promoRef.current!, {
            pixelRatio: 1,
            cacheBust: true,
            width,
            height,
          });
          const res = await savePromoImage(promoRender.type, dataUrl);
          promoRender.resolve(res.imageUrl);
          setResultFilename(res.filename);
        } catch (e) {
          promoRender.reject(e instanceof Error ? e : new Error(String(e)));
        } finally {
          setPromoRender(null);
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [promoRender]);

  const handleSave = async () => {
    setSaving(true);
    setResultUrl(null);
    try {
      const imageUrl = await new Promise<string>((resolve, reject) => {
        setPromoRender({ type: promoType, data: promoData, resolve, reject });
      });
      setResultUrl(imageUrl);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleTypeChange = (t: PromoType) => {
    setPromoType(t);
    setPromoData(emptyPromoData(t));
    setResultUrl(null);
  };

  const resolvedResultUrl = resultUrl ? resolveMediaUrl(resultUrl) : null;

  return (
    <div className="space-y-4">
      {/* Template selector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">เลือกประเภทโปรโมชั่น</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {PROMO_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleTypeChange(opt.id)}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                  promoType === opt.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{opt.description}</span>
                <Badge variant="outline" className="mt-2 text-[10px]">
                  {opt.width}×{opt.height}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              กรอกข้อมูล — {PROMO_OPTIONS.find((o) => o.id === promoType)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {promoType === 'spend_free_gift' && (
              <SpendFreeGiftForm
                data={promoData as SpendFreeGiftData}
                setData={(d) => setPromoData(d)}
                products={products}
              />
            )}
            {promoType === 'buy_x_get_y' && (
              <BuyXGetYForm
                data={promoData as BuyXGetYData}
                setData={(d) => setPromoData(d)}
                products={products}
              />
            )}
            {promoType === 'bundle_deal' && (
              <BundleDealForm
                data={promoData as BundleDealData}
                setData={(d) => setPromoData(d)}
                products={products}
              />
            )}
            {promoType === 'new_arrival' && (
              <NewArrivalForm
                data={promoData as NewArrivalData}
                setData={(d) => setPromoData(d)}
                products={products}
              />
            )}
            {promoType === 'clearance_sale' && (
              <ClearanceSaleForm
                data={promoData as ClearanceSaleData}
                setData={(d) => setPromoData(d)}
                products={products}
              />
            )}

            <Button
              className="w-full mt-2"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังสร้างโปสเตอร์...</>
                : <><Sparkles className="mr-2 h-4 w-4" />สร้างโปสเตอร์ (บันทึก PNG)</>}
            </Button>
          </CardContent>
        </Card>

        {/* Result preview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ผลลัพธ์</CardTitle>
          </CardHeader>
          <CardContent>
            {saving && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">กำลังสร้างโปสเตอร์...</p>
              </div>
            )}
            {!saving && resolvedResultUrl && (
              <div className="space-y-3">
                <img
                  src={resolvedResultUrl}
                  alt="promotion poster"
                  className="w-full rounded-lg border shadow"
                />
                <div className="flex gap-2">
                  <a
                    href={resolvedResultUrl}
                    download={resultFilename ?? 'promo-poster.png'}
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full gap-1.5">
                      <Download className="h-4 w-4" />
                      ดาวน์โหลด PNG
                    </Button>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  บันทึกใน Files แล้ว — ดูที่แท็บ &quot;ไฟล์ที่สร้าง&quot;
                </p>
              </div>
            )}
            {!saving && !resolvedResultUrl && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground/50">
                <p className="text-sm">กรอกข้อมูลแล้วกด &quot;สร้างโปสเตอร์&quot;</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Off-screen renderer for capture */}
      {promoRender && (
        <div aria-hidden style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none', zIndex: -1 }}>
          <div ref={promoRef}>
            <PromoTemplateRenderer type={promoRender.type} data={promoRender.data} />
          </div>
        </div>
      )}
    </div>
  );
}
