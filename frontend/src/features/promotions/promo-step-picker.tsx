'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, Sparkles, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSkuPromotionSteps } from '@/lib/erp-api';
import type { SkuPromotionStep } from '@/lib/types';

// ─── Pure UI picker (stateless, for embedding in forms that manage state) ────

export function PromoStepPicker({
  steps,
  loading,
  selected,
  onSelect,
  onClear,
}: {
  steps: SkuPromotionStep[];
  loading: boolean;
  selected: SkuPromotionStep | null;
  onSelect: (step: SkuPromotionStep) => void;
  onClear: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        กำลังดึงโปรโมชันจาก ERP...
      </div>
    );
  }

  if (steps.length === 0) return null;

  const now = new Date();
  const activeSteps = steps.filter((s) => !s.dateStop || new Date(s.dateStop) >= now);

  return (
    <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          โปรโมชัน ERP ({activeSteps.length} รายการ)
        </p>
        {selected && (
          <button type="button" onClick={onClear} className="text-[10px] text-muted-foreground hover:text-foreground underline">
            ล้าง
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {activeSteps.map((step) => {
          const isSelected = selected?.campaignId === step.campaignId;
          return (
            <button
              key={step.campaignId}
              type="button"
              onClick={() => onSelect(step)}
              className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:border-primary hover:bg-muted'
              }`}
            >
              <span className="font-semibold truncate max-w-[160px]">{step.campaignName}</span>
              <span className="mt-0.5 text-primary font-bold">฿{Math.round(step.promoPrice)}</span>
              <span className="text-muted-foreground">{step.stepText}</span>
              {step.gp != null && (
                <span className={`text-[10px] mt-0.5 ${step.gp >= 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  GP {step.gp.toFixed(1)}%
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="text-[10px] text-muted-foreground">
          เลือกแล้ว: <span className="font-medium text-primary">{selected.campaignName} — {selected.stepText}</span>
          {' '}· จะเก็บ Campaign ID เพื่อ trace ได้ตอน Review
        </p>
      )}
    </div>
  );
}

// ─── Auto-fill data returned to the parent ───────────────────────────────────

export interface PromoAutoFill {
  sku: string;
  price: number;
  retailPrice: number;
  promotion: string;
  stepText: string;
  campaignId: number;
  campaignName: string;
  minAmount: number;
  minQty: number;
}

// ─── Combined SKU input + fetch + picker ─────────────────────────────────────

export function SkuPromoStepSelector({
  initialSku = '',
  label = 'SKU สินค้า (ดึงโปรจาก ERP อัตโนมัติ)',
  onApply,
}: {
  initialSku?: string;
  label?: string;
  onApply: (fill: PromoAutoFill) => void;
}) {
  const [sku, setSku] = useState(initialSku);
  const [steps, setSteps] = useState<SkuPromotionStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SkuPromotionStep | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = sku.replace(/\s+/g, '').toUpperCase();
    if (q.length < 4) {
      setSteps([]);
      setSelected(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setSelected(null);
      getSkuPromotionSteps(q)
        .then((res) => setSteps(res.items))
        .catch(() => setSteps([]))
        .finally(() => setLoading(false));
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sku]);

  const handleSelect = (step: SkuPromotionStep) => {
    setSelected(step);
    onApply({
      sku: sku.replace(/\s+/g, '').toUpperCase(),
      price: step.promoPrice,
      retailPrice: step.retailPrice,
      promotion: step.stepText,
      stepText: step.stepText,
      campaignId: step.campaignId,
      campaignName: step.campaignName,
      minAmount: step.minAmount ?? 0,
      minQty: step.minQty,
    });
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">นำเข้าจาก ERP</span>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="พิมพ์ SKU เช่น RT20787"
            className="pl-9 pr-9 font-mono text-sm uppercase"
          />
          {sku && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => { setSku(''); setSteps([]); setSelected(null); }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <PromoStepPicker
        steps={steps}
        loading={loading}
        selected={selected}
        onSelect={handleSelect}
        onClear={() => setSelected(null)}
      />
    </div>
  );
}
