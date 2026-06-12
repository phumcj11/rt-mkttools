'use client';

import { useState } from 'react';
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
// Helpers
// ---------------------------------------------------------------------------

/** Strip proxy image URLs — GPT Image uses referenceImageUrl separately */
function sanitizePromoDataForAi(data: PromoData): Record<string, unknown> {
  const copy = { ...(data as unknown as Record<string, unknown>) };

  const renameIfText = (from: string, to: string) => {
    const v = copy[from];
    if (typeof v === 'string' && v && !v.startsWith('http')) copy[to] = v;
    delete copy[from];
  };

  renameIfText('productImage', 'productName');
  renameIfText('mainProductImage', 'mainProductName');
  renameIfText('product1Image', 'product1Name');
  renameIfText('product2Image', 'product2Name');
  delete copy.buyProductImage;
  delete copy.getProductImage;

  if (Array.isArray(copy.products)) {
    copy.products = (copy.products as ClearanceSaleProduct[]).map(({ image: _img, ...rest }) => rest);
  }
  return copy;
}

function ProductPicker({
  label,
  products,
  selectedSku,
  onChange,
  onReferenceImage,
}: {
  label: string;
  products: ErpProduct[];
  selectedSku: string;
  onChange: (sku: string, name: string) => void;
  onReferenceImage?: (originalUrl: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={selectedSku}
        onChange={(e) => {
          const p = products.find((x) => x.sku === e.target.value);
          if (p) {
            onChange(p.sku, p.name);
            onReferenceImage?.(p.imageUrl);
          }
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
  onReferenceImage,
}: {
  data: SpendFreeGiftData;
  setData: (d: SpendFreeGiftData) => void;
  products: ErpProduct[];
  onReferenceImage: (url: string) => void;
}) {
  const [sku, setSku] = useState('');
  return (
    <div className="space-y-3">
      <ProductPicker
        label="สินค้าหลัก (AI ใช้รูป ERP เป็นฐาน)"
        products={products}
        selectedSku={sku}
        onReferenceImage={onReferenceImage}
        onChange={(s, name) => {
          setSku(s);
          setData({ ...data, productImage: name, spendAmount: data.spendAmount });
        }}
      />
      <TextF label="ยอดซื้อขั้นต่ำ (Spend Amount)" value={data.spendAmount}
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
  onReferenceImage,
}: {
  data: BuyXGetYData;
  setData: (d: BuyXGetYData) => void;
  products: ErpProduct[];
  onReferenceImage: (url: string) => void;
}) {
  const [mainSku, setMainSku] = useState('');
  const [buySku, setBuySku] = useState('');
  const [getSku, setGetSku] = useState('');
  return (
    <div className="space-y-3">
      <ProductPicker label="สินค้าหลัก (AI ใช้รูป ERP เป็นฐาน)" products={products} selectedSku={mainSku}
        onReferenceImage={onReferenceImage}
        onChange={(s, name) => { setMainSku(s); setData({ ...data, mainProductImage: name }); }} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 border rounded-md p-2">
          <p className="text-xs font-semibold text-red-600">BUY (ซื้อ)</p>
          <ProductPicker label="สินค้า BUY" products={products} selectedSku={buySku}
            onChange={(s, name) => { setBuySku(s); setData({ ...data, buyProductName: name }); }} />
        </div>
        <div className="space-y-2 border rounded-md p-2">
          <p className="text-xs font-semibold text-red-600">GET (รับฟรี)</p>
          <ProductPicker label="สินค้า GET" products={products} selectedSku={getSku}
            onChange={(s, name) => { setGetSku(s); setData({ ...data, getProductName: name }); }} />
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
  onReferenceImage,
}: {
  data: BundleDealData;
  setData: (d: BundleDealData) => void;
  products: ErpProduct[];
  onReferenceImage: (url: string) => void;
}) {
  const [sku1, setSku1] = useState('');
  const [sku2, setSku2] = useState('');
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <ProductPicker label="สินค้า 1 (AI ใช้รูปเป็นฐาน)" products={products} selectedSku={sku1}
            onReferenceImage={onReferenceImage}
            onChange={(s, name) => { setSku1(s); setData({ ...data, product1Name: name }); }} />
        </div>
        <div className="space-y-2">
          <ProductPicker label="สินค้า 2" products={products} selectedSku={sku2}
            onChange={(s, name) => { setSku2(s); setData({ ...data, product2Name: name }); }} />
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
  onReferenceImage,
}: {
  data: NewArrivalData;
  setData: (d: NewArrivalData) => void;
  products: ErpProduct[];
  onReferenceImage: (url: string) => void;
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
      <ProductPicker label="สินค้า (AI ใช้รูป ERP เป็นฐาน)" products={products} selectedSku={sku}
        onReferenceImage={onReferenceImage}
        onChange={(s, name) => { setSku(s); setSelectedSku(s); setData({ ...data, productImage: name }); }} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">จุดเด่น 3 ข้อ — AI จะใส่ในโปสเตอร์</p>
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
  onReferenceImage,
}: {
  data: ClearanceSaleData;
  setData: (d: ClearanceSaleData) => void;
  products: ErpProduct[];
  onReferenceImage: (url: string) => void;
}) {
  const [mainSku, setMainSku] = useState('');
  const [smallSkus, setSmallSkus] = useState(['', '', '']);

  const updateProduct = (i: number, name: string, sku: string) => {
    const updated = [...data.products];
    updated[i] = { ...updated[i], name };
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
      <ProductPicker label="สินค้าหลัก (AI ใช้รูป ERP เป็นฐาน)" products={products} selectedSku={mainSku}
        onReferenceImage={onReferenceImage}
        onChange={(s, name) => { setMainSku(s); setData({ ...data, mainProductName: name }); }} />
      <TextF label='ลดสูงสุด "UP TO X% OFF"' value={data.discountPercent}
        onChange={(v) => setData({ ...data, discountPercent: v })} placeholder="เช่น 50" />

      <p className="text-xs font-semibold text-muted-foreground pt-1">สินค้า SPECIAL PRICE (3 ช่อง)</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border rounded-md p-2 space-y-2">
          <p className="text-xs font-semibold">สินค้า {i + 1}</p>
          <ProductPicker label={`สินค้า ${i + 1}`} products={products} selectedSku={smallSkus[i]}
            onChange={(s, name) => updateProduct(i, name, s)} />
          <div className="grid grid-cols-2 gap-2">
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

export function PromoTab({ products }: { products: ErpProduct[] }) {
  const [promoType, setPromoType] = useState<PromoType>('spend_free_gift');
  const [promoData, setPromoData] = useState<PromoData>(() => emptyPromoData('spend_free_gift'));
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setResultUrl(null);
    setLastModel(null);
    try {
      const res = await generatePromoGptImage(
        promoType,
        sanitizePromoDataForAi(promoData),
        referenceImageUrl || undefined,
      );
      setResultUrl(res.imageUrl);
      setResultFilename(res.filename);
      setLastModel(res.model);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'สร้างโปสเตอร์ไม่สำเร็จ');
    } finally {
      setGenerating(false);
    }
  };

  const handleTypeChange = (t: PromoType) => {
    setPromoType(t);
    setPromoData(emptyPromoData(t));
    setReferenceImageUrl('');
    setResultUrl(null);
    setLastModel(null);
  };

  const resolvedResultUrl = resultUrl ? resolveMediaUrl(resultUrl) : null;
  const refFormProps = { onReferenceImage: setReferenceImageUrl };

  return (
    <div className="space-y-4">
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
                <Badge variant="outline" className="mt-2 text-[10px]">GPT Image</Badge>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            ใช้ Template PNG 5 แบบเป็น reference → AI คิด prompt ใส่ข้อมูล → GPT Image แก้ไข template (~15–30 วิ)
            {referenceImageUrl ? ' · วิเคราะห์รูป ERP เพื่อวาดสินค้าให้ตรง' : ''}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              กรอกข้อมูล — {PROMO_OPTIONS.find((o) => o.id === promoType)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {promoType === 'spend_free_gift' && (
              <SpendFreeGiftForm data={promoData as SpendFreeGiftData} setData={setPromoData} products={products} {...refFormProps} />
            )}
            {promoType === 'buy_x_get_y' && (
              <BuyXGetYForm data={promoData as BuyXGetYData} setData={setPromoData} products={products} {...refFormProps} />
            )}
            {promoType === 'bundle_deal' && (
              <BundleDealForm data={promoData as BundleDealData} setData={setPromoData} products={products} {...refFormProps} />
            )}
            {promoType === 'new_arrival' && (
              <NewArrivalForm data={promoData as NewArrivalData} setData={setPromoData} products={products} {...refFormProps} />
            )}
            {promoType === 'clearance_sale' && (
              <ClearanceSaleForm data={promoData as ClearanceSaleData} setData={setPromoData} products={products} {...refFormProps} />
            )}

            <Button className="w-full mt-2" onClick={() => void handleGenerate()} disabled={generating}>
              {generating
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI กำลังสร้างโปสเตอร์...</>
                : <><Sparkles className="mr-2 h-4 w-4" />สร้างด้วย GPT Image</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ผลลัพธ์ AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {generating && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">AI กำลังคิด prompt และสร้างภาพ...</p>
                <p className="text-xs">ใช้เวลาประมาณ 15–30 วินาที</p>
              </div>
            )}
            {!generating && resolvedResultUrl && (
              <div className="space-y-3">
                <img src={resolvedResultUrl} alt="AI promotion poster" className="w-full rounded-lg border shadow" />
                {lastModel && (
                  <Badge variant="secondary" className="text-xs">AI Generated · {lastModel}</Badge>
                )}
                <a href={resolvedResultUrl} download={resultFilename ?? 'promo-poster.png'}>
                  <Button variant="outline" className="w-full gap-1.5">
                    <Download className="h-4 w-4" />
                    ดาวน์โหลด PNG
                  </Button>
                </a>
                <p className="text-xs text-muted-foreground">บันทึกในแท็บ &quot;ไฟล์ที่สร้าง&quot; แล้ว</p>
              </div>
            )}
            {!generating && !resolvedResultUrl && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground/50">
                <Sparkles className="h-8 w-8" />
                <p className="text-sm">กรอกข้อมูลแล้วกด &quot;สร้างด้วย GPT Image&quot;</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
