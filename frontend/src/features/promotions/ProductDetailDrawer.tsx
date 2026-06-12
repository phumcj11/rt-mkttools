'use client';

import { useEffect, useState } from 'react';
import { getErpProductDetail, type ErpProductDetail } from '@/lib/erp-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  sku: string | null;
  open: boolean;
  onClose: () => void;
}

const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const fmtQty = (n: number) =>
  n.toLocaleString('th-TH');

function GpBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-400 text-xs">N/A</span>;
  const color =
    pct >= 30 ? 'bg-green-100 text-green-700' :
    pct >= 15 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${color}`}>
      {fmtPct(pct)}
    </span>
  );
}

export function ProductDetailDrawer({ sku, open, onClose }: Props) {
  const [detail, setDetail] = useState<ErpProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sku) return;
    setDetail(null);
    setError(null);
    setLoading(true);
    getErpProductDetail(sku)
      .then(setDetail)
      .catch(() => setError('โหลดข้อมูลสินค้าไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [sku, open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 font-mono">{sku}</p>
            <h2 className="text-base font-semibold text-gray-900 truncate leading-snug">
              {detail?.name ?? (loading ? 'กำลังโหลด…' : sku)}
            </h2>
            {detail && (
              <p className="text-xs text-gray-500 mt-0.5">
                {[detail.brand, detail.category].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0 ml-3">
            ✕
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-400">
              กำลังโหลดข้อมูล…
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {detail && (
            <>
              {/* Product image */}
              {detail.imageUrl && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detail.imageUrl}
                    alt={detail.name}
                    className="h-32 w-32 object-contain rounded-lg border bg-gray-50"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Price / GP Card */}
              <div className="rounded-xl border bg-gray-50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  ราคา & GP
                </div>
                <div className="divide-y">
                  <Row label="ราคาต้นทุน" value={`฿${fmt(detail.costPrice)}`} />
                  <Row label="ราคาขายปกติ" value={`฿${fmt(detail.retailPrice)}`} />
                  <Row
                    label="GP ปกติ"
                    value={<GpBadge pct={detail.normalGpPct} />}
                  />
                  {detail.abcCompany && (
                    <Row
                      label="ABC Class"
                      value={
                        <Badge variant="outline" className="text-xs font-mono">
                          {detail.abcCompany}
                        </Badge>
                      }
                    />
                  )}
                </div>
              </div>

              {/* Sales summary */}
              {detail.sales && (
                <div className="rounded-xl border bg-gray-50 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    ยอดขาย {detail.sales.periodDays} วันล่าสุด
                  </div>
                  <div className="divide-y">
                    <Row label="ยอดขาย (บาท)" value={`฿${fmt(detail.sales.revenue)}`} />
                    <Row label="จำนวนที่ขาย" value={`${fmtQty(detail.sales.qtySold)} ชิ้น`} />
                    <Row label="GP (บาท)" value={`฿${fmt(detail.sales.gpBaht)}`} />
                    <Row label="GP (%)" value={<GpBadge pct={detail.sales.gpPct} />} />
                  </div>
                </div>
              )}

              {/* Promotions */}
              <div className="rounded-xl border overflow-hidden">
                <div className="px-4 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center justify-between">
                  <span>โปรโมชันที่เข้าร่วม</span>
                  <span className="bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs">
                    {detail.promotions.length} รายการ
                  </span>
                </div>

                {detail.promotions.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-400">ไม่มีโปรโมชันที่ใช้งานอยู่</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">ชื่อโปร</th>
                          <th className="px-3 py-2 text-right font-medium">ราคาโปร</th>
                          <th className="px-3 py-2 text-left font-medium">เงื่อนไข</th>
                          <th className="px-3 py-2 text-right font-medium">GP เหลือ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detail.promotions.map((promo) => (
                          <tr key={promo.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 max-w-[180px]">
                              <p className="font-medium text-gray-800 leading-snug">{promo.name}</p>
                              {promo.typeName && (
                                <p className="text-xs text-gray-400">{promo.typeName}</p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-red-600 font-semibold whitespace-nowrap">
                              ฿{fmt(promo.promoPrice)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 max-w-[140px]">
                              {promo.conditions}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <GpBadge pct={promo.remainingGpPct} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
