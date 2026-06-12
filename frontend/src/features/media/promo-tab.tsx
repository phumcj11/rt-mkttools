'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Layers,
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
  generatePromoComposite,
  generatePromoFeatures,
  generatePromoGptImage,
  resolveMediaUrl,
  type ErpProduct,
} from '@/lib/media-api';
import {
  emptyPromoData,
  PROMO_OPTIONS,
  type BundleDealData,
  type BuyXGetYData,
  type ClearanceSaleData,
  type ClearanceSaleProduct,
  type NewArrivalData,
  type PromoData,
  type PromoType,
  type SpendFreeGiftData,
} from './promo-templates';

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type Step = 'idle' | 'cutout' | 'composite' | 'done' | 'ai';

const STEP_LABELS: Record<Step, string> = {
  idle: '',
  cutout: 'กำลังไดคัทรูปสินค้า…',
  composite: 'กำลังประกอบโปสเตอร์…',
  done: 'เสร็จแล้ว',
  ai: 'AI กำลังสร้างโปสเตอร์…',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build flat text-only data and imageUrls map from form state */
function buildCompositePayload(
  promoType: PromoType,
  promoData: PromoData,
  imageUrls: Record<string, string>,
): { data: Record<string, string>; imageUrls: Record<string, string> } {
  const data: Record<string, string> = {};

  if (promoType === 'spend_free_gift') {
    const d = promoData as SpendFreeGiftData;
    data.spendAmount = d.spendAmount;
    data.freeGift = d.freeGift;
    data.validDate = d.validDate;
  } else if (promoType === 'buy_x_get_y') {
    const d = promoData as BuyXGetYData;
    data.buyProductName = d.buyProductName;
    data.getProductName = d.getProductName;
    data.validDate = d.validDate;
  } else if (promoType === 'bundle_deal') {
    const d = promoData as BundleDealData;
    data.product1Name = d.product1Name;
    data.product2Name = d.product2Name;
    data.bundlePrice = d.bundlePrice;
    data.freeGiftName = d.freeGiftName ?? '';
    data.validDate = d.validDate;
  } else if (promoType === 'new_arrival') {
    const d = promoData as NewArrivalData;
    data.feature1 = d.feature1;
    data.feature2 = d.feature2;
    data.feature3 = d.feature3;
    data.validDate = d.validDate;
  } else if (promoType === 'clearance_sale') {
    const d = promoData as ClearanceSaleData;
    data.mainProductName = d.mainProductName;
    data.discountPercent = d.discountPercent;
    data.validDate = d.validDate;
    d.products.slice(0, 3).forEach((p, i) => {
      data[`product${i}Price`] = p.price;
      data[`product${i}Name`] = p.name;
    });
  }

  return { data, imageUrls };
}

/** Build sanitized data for GPT Image (no URLs) */
function sanitizePromoDataForAi(data: PromoData): Record<string, unknown> {
  const copy = { ...(data as unknown as Record<string, unknown>) };
  const removeIfUrl = (...keys: string[]) => keys.forEach((k) => { if (typeof copy[k] === 'string' && (copy[k] as string).startsWith('http')) delete copy[k]; });
  removeIfUrl('productImage', 'mainProductImage', 'product1Image', 'product2Image', 'buyProductImage', 'getProductImage');
  if (Array.isArray(copy.products)) {
    copy.products = (copy.products as ClearanceSaleProduct[]).map(({ image: _img, ...rest }) => rest);
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Shared form atoms
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
  onChange: (sku: string, name: string, imageUrl: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={selectedSku}
        onChange={(e) => {
          const p = products.find((x) => x.sku === e.target.value);
          if (p) onChange(p.sku, p.name, p.imageUrl);
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
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-template forms
// ---------------------------------------------------------------------------

function SpendFreeGiftForm({
  data, setData, products, onImageUrl,
}: {
  data: SpendFreeGiftData;
  setData: (d: SpendFreeGiftData) => void;
  products: ErpProduct[];
  onImageUrl: (slot: string, url: string) => void;
}) {
  const [sku, setSku] = useState('');
  return (
    <div className="space-y-3">
      <ProductPicker label="สินค้าหลัก" products={products} selectedSku={sku}
        onChange={(s, name, url) => { setSku(s); onImageUrl('productImage', url); setData({ ...data, productImage: name }); }} />
      <TextF label="ยอดซื้อขั้นต่ำ (Spend Amount)" value={data.spendAmount}
        onChange={(v) => setData({ ...data, spendAmount: v })} placeholder="เช่น 299" />
      <div className="space-y-1">
        <Label className="text-xs">ของแถม (Free Gift)</Label>
        <Textarea value={data.freeGift} onChange={(e) => setData({ ...data, freeGift: e.target.value })}
          placeholder="เช่น กระเป๋าผ้าสุดน่ารัก 1 ใบ" rows={2} className="text-sm" />
      </div>
      <TextF label="วันหมดเขต" value={data.validDate}
        onChange={(v) => setData({ ...data, validDate: v })} placeholder="เช่น 30 มิ.ย. 2569" />
    </div>
  );
}

function BuyXGetYForm({
  data, setData, products, onImageUrl,
}: {
  data: BuyXGetYData;
  setData: (d: BuyXGetYData) => void;
  products: ErpProduct[];
  onImageUrl: (slot: string, url: string) => void;
}) {
  const [mainSku, setMainSku] = useState('');
  const [buySku, setBuySku] = useState('');
  const [getSku, setGetSku] = useState('');
  return (
    <div className="space-y-3">
      <ProductPicker label="สินค้าหลัก (ภาพใหญ่)" products={products} selectedSku={mainSku}
        onChange={(s, name, url) => { setMainSku(s); onImageUrl('mainProductImage', url); setData({ ...data, mainProductImage: name }); }} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 border rounded-md p-2">
          <p className="text-xs font-semibold text-red-600">BUY (ซื้อ)</p>
          <ProductPicker label="สินค้า BUY" products={products} selectedSku={buySku}
            onChange={(s, name, url) => { setBuySku(s); onImageUrl('buyProductImage', url); setData({ ...data, buyProductName: name }); }} />
        </div>
        <div className="space-y-2 border rounded-md p-2">
          <p className="text-xs font-semibold text-red-600">GET (รับฟรี)</p>
          <ProductPicker label="สินค้า GET" products={products} selectedSku={getSku}
            onChange={(s, name, url) => { setGetSku(s); onImageUrl('getProductImage', url); setData({ ...data, getProductName: name }); }} />
        </div>
      </div>
      <TextF label="วันหมดเขต" value={data.validDate}
        onChange={(v) => setData({ ...data, validDate: v })} placeholder="เช่น 30 มิ.ย. 2569" />
    </div>
  );
}

function BundleDealForm({
  data, setData, products, onImageUrl,
}: {
  data: BundleDealData;
  setData: (d: BundleDealData) => void;
  products: ErpProduct[];
  onImageUrl: (slot: string, url: string) => void;
}) {
  const [sku1, setSku1] = useState('');
  const [sku2, setSku2] = useState('');
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <ProductPicker label="สินค้า 1" products={products} selectedSku={sku1}
          onChange={(s, name, url) => { setSku1(s); onImageUrl('product1Image', url); setData({ ...data, product1Name: name }); }} />
        <ProductPicker label="สินค้า 2" products={products} selectedSku={sku2}
          onChange={(s, name, url) => { setSku2(s); onImageUrl('product2Image', url); setData({ ...data, product2Name: name }); }} />
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
  data, setData, products, onImageUrl,
}: {
  data: NewArrivalData;
  setData: (d: NewArrivalData) => void;
  products: ErpProduct[];
  onImageUrl: (slot: string, url: string) => void;
}) {
  const [sku, setSku] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleAiFeatures = async () => {
    if (!sku) { alert('เลือกสินค้าก่อน'); return; }
    setAiLoading(true);
    try {
      const res = await generatePromoFeatures(sku);
      setData({ ...data, feature1: res.feature1, feature2: res.feature2, feature3: res.feature3 });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'AI generate ล้มเหลว');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <ProductPicker label="สินค้า" products={products} selectedSku={sku}
        onChange={(s, name, url) => { setSku(s); onImageUrl('productImage', url); setData({ ...data, productImage: name }); }} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">จุดเด่น 3 ข้อ</p>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
          onClick={() => void handleAiFeatures()} disabled={aiLoading}>
          {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          AI Generate Features
        </Button>
      </div>
      <TextF label="Feature 1" value={data.feature1} onChange={(v) => setData({ ...data, feature1: v })} placeholder="เช่น สินค้าใหม่ ล่าสุด" />
      <TextF label="Feature 2" value={data.feature2} onChange={(v) => setData({ ...data, feature2: v })} placeholder="เช่น คุณภาพดี ใช้ทน" />
      <TextF label="Feature 3" value={data.feature3} onChange={(v) => setData({ ...data, feature3: v })} placeholder="เช่น ราคาคุ้มค่า ฿100" />
      <TextF label="วันหมดเขต" value={data.validDate} onChange={(v) => setData({ ...data, validDate: v })} placeholder="เช่น 30 มิ.ย. 2569" />
    </div>
  );
}

function ClearanceSaleForm({
  data, setData, products, onImageUrl,
}: {
  data: ClearanceSaleData;
  setData: (d: ClearanceSaleData) => void;
  products: ErpProduct[];
  onImageUrl: (slot: string, url: string) => void;
}) {
  const [mainSku, setMainSku] = useState('');
  const [smallSkus, setSmallSkus] = useState(['', '', '']);

  const updateProduct = (i: number, name: string, sku: string, imageUrl: string) => {
    const updated = [...data.products];
    updated[i] = { ...updated[i], name };
    const newSkus = [...smallSkus]; newSkus[i] = sku; setSmallSkus(newSkus);
    onImageUrl(`product${i}Image`, imageUrl);
    setData({ ...data, products: updated });
  };
  const updateField = (i: number, field: string, value: string) => {
    const updated = [...data.products];
    updated[i] = { ...updated[i], [field]: value };
    setData({ ...data, products: updated });
  };

  return (
    <div className="space-y-3">
      <ProductPicker label="สินค้าหลัก" products={products} selectedSku={mainSku}
        onChange={(s, name, url) => { setMainSku(s); onImageUrl('mainProductImage', url); setData({ ...data, mainProductName: name }); }} />
      <TextF label='ลดสูงสุด "UP TO X% OFF"' value={data.discountPercent}
        onChange={(v) => setData({ ...data, discountPercent: v })} placeholder="เช่น 50" />
      <p className="text-xs font-semibold text-muted-foreground pt-1">สินค้า SPECIAL PRICE (3 ช่อง)</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border rounded-md p-2 space-y-2">
          <p className="text-xs font-semibold">สินค้า {i + 1}</p>
          <ProductPicker label={`สินค้า ${i + 1}`} products={products} selectedSku={smallSkus[i]}
            onChange={(s, name, url) => updateProduct(i, name, s, url)} />
          <div className="grid grid-cols-2 gap-2">
            <TextF label="ราคา" value={data.products[i]?.price ?? ''}
              onChange={(v) => updateField(i, 'price', v)} placeholder="฿" />
            <TextF label="ลด %" value={data.products[i]?.savePercent ?? ''}
              onChange={(v) => updateField(i, 'savePercent', v)} placeholder="%" />
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

export function PromoTab({ products }: { products: ErpProduct[] }) {
  const [promoType, setPromoType] = useState<PromoType>('spend_free_gift');
  const [promoData, setPromoData] = useState<PromoData>(() => emptyPromoData('spend_free_gift'));
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [useGpt, setUseGpt] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<string | null>(null);

  const handleImageUrl = (slot: string, url: string) => {
    setImageUrls((prev) => ({ ...prev, [slot]: url }));
  };

  const handleTypeChange = (t: PromoType) => {
    setPromoType(t);
    setPromoData(emptyPromoData(t));
    setImageUrls({});
    setResultUrl(null);
    setResultMeta(null);
    setStep('idle');
  };

  const handleGenerate = async () => {
    setResultUrl(null);
    setResultMeta(null);

    if (useGpt) {
      setStep('ai');
      try {
        const refUrl = Object.values(imageUrls)[0] ?? undefined;
        const res = await generatePromoGptImage(promoType, sanitizePromoDataForAi(promoData), refUrl);
        setResultUrl(res.imageUrl);
        setResultFilename(res.filename);
        setResultMeta(`AI Creative · ${res.model}`);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'สร้างโปสเตอร์ไม่สำเร็จ');
      } finally {
        setStep('done');
      }
      return;
    }

    // Composite mode
    const hasImages = Object.values(imageUrls).some(Boolean);
    setStep(hasImages ? 'cutout' : 'composite');

    try {
      const { data, imageUrls: urls } = buildCompositePayload(promoType, promoData, imageUrls);

      if (hasImages) {
        // Small delay so the cutout step label is visible
        await new Promise((r) => setTimeout(r, 300));
        setStep('composite');
      }

      const res = await generatePromoComposite(promoType, data, urls);
      setResultUrl(res.imageUrl);
      setResultFilename(res.filename);
      setResultMeta(res.cutoutUsed ? 'ไดคัทแล้ว · Composite' : 'Composite');
      setStep('done');
    } catch (e) {
      setStep('idle');
      alert(e instanceof Error ? e.message : 'สร้างโปสเตอร์ไม่สำเร็จ');
    }
  };

  const isGenerating = step === 'cutout' || step === 'composite' || step === 'ai';
  const resolvedResultUrl = resultUrl ? resolveMediaUrl(resultUrl) : null;
  const formProps = { products, onImageUrl: handleImageUrl };

  return (
    <div className="space-y-4">
      {/* Promo type selector */}
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
                <Badge variant="outline" className="mt-2 text-[10px]">Composite</Badge>
              </button>
            ))}
          </div>

          {/* Mode toggle */}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setUseGpt(false)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                !useGpt ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Standard (แนะนำ)
            </button>
            <button
              type="button"
              onClick={() => setUseGpt(true)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                useGpt ? 'bg-violet-600 text-white border-violet-600' : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Creative (GPT Image)
            </button>
          </div>
          {useGpt && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              โหมด AI Creative: GPT Image วาดโปสเตอร์ทั้งใบจาก template (~15–30 วิ, ~฿1.5/รูป) — ผลลัพธ์อาจแตกต่างจาก template ต้นฉบับ
            </p>
          )}
          {!useGpt && (
            <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              โหมด Standard: ใช้ template PNG ต้นฉบับ → วาง text/รูปสินค้าในตำแหน่งที่กำหนด (~2–5 วิ)
              {Object.values(imageUrls).some(Boolean) ? ' · จะพยายามไดคัทรูปผ่าน n8n (หากตั้งค่าไว้)' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {useGpt ? <Sparkles className="h-4 w-4 text-violet-500" /> : <Layers className="h-4 w-4 text-primary" />}
              กรอกข้อมูล — {PROMO_OPTIONS.find((o) => o.id === promoType)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {promoType === 'spend_free_gift' && (
              <SpendFreeGiftForm data={promoData as SpendFreeGiftData} setData={setPromoData} {...formProps} />
            )}
            {promoType === 'buy_x_get_y' && (
              <BuyXGetYForm data={promoData as BuyXGetYData} setData={setPromoData} {...formProps} />
            )}
            {promoType === 'bundle_deal' && (
              <BundleDealForm data={promoData as BundleDealData} setData={setPromoData} {...formProps} />
            )}
            {promoType === 'new_arrival' && (
              <NewArrivalForm data={promoData as NewArrivalData} setData={setPromoData} {...formProps} />
            )}
            {promoType === 'clearance_sale' && (
              <ClearanceSaleForm data={promoData as ClearanceSaleData} setData={setPromoData} {...formProps} />
            )}

            <Button
              className={`w-full mt-2 ${useGpt ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
              onClick={() => void handleGenerate()}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{STEP_LABELS[step]}</>
              ) : useGpt ? (
                <><Sparkles className="mr-2 h-4 w-4" />สร้างด้วย AI Creative</>
              ) : (
                <><Layers className="mr-2 h-4 w-4" />สร้างโปสเตอร์</>
              )}
            </Button>

            {/* Progress steps (composite mode) */}
            {!useGpt && isGenerating && (
              <div className="flex items-center gap-3 mt-2">
                <StepDot done={step === 'composite'} active={step === 'cutout'} label="ไดคัทสินค้า" />
                <div className="flex-1 h-px bg-border" />
                <StepDot done={false} active={step === 'composite'} label="ประกอบ template" />
                <div className="flex-1 h-px bg-border" />
                <StepDot done={false} active={false} label="เสร็จ" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ผลลัพธ์</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isGenerating && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">{STEP_LABELS[step]}</p>
                {!useGpt && <p className="text-xs">logo และ mascot ไม่ถูกแก้ไข</p>}
              </div>
            )}
            {!isGenerating && resolvedResultUrl && (
              <div className="space-y-3">
                <img src={resolvedResultUrl} alt="promotion poster" className="w-full rounded-lg border shadow" />
                {resultMeta && (
                  <Badge variant="secondary" className="text-xs">{resultMeta}</Badge>
                )}
                <a href={resolvedResultUrl} download={resultFilename ?? 'promo-poster.png'}>
                  <Button variant="outline" className="w-full gap-1.5">
                    <Download className="h-4 w-4" />
                    ดาวน์โหลด PNG
                  </Button>
                </a>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  บันทึกในแท็บ &quot;ไฟล์ที่สร้าง&quot; แล้ว
                </p>
              </div>
            )}
            {!isGenerating && !resolvedResultUrl && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground/50">
                <Layers className="h-8 w-8" />
                <p className="text-sm">กรอกข้อมูลแล้วกด &quot;สร้างโปสเตอร์&quot;</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StepDot({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs ${
        done ? 'bg-green-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {done ? <CheckCircle2 className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : '·'}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
