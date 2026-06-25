'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Package } from 'lucide-react';
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
  getBranchCountryAnalytics,
  getBranchCountryProducts,
  type BranchCountryAnalyticsData,
  type BranchCountryProductsData,
} from '@/lib/revenue-api';

function baht(value: number): string {
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

type RangePreset = 'last7' | 'last15' | 'last30' | 'mtd';

const RANGE_OPTIONS: { id: RangePreset; label: string }[] = [
  { id: 'last7', label: '7 วัน' },
  { id: 'last15', label: '15 วัน' },
  { id: 'last30', label: '30 วัน' },
  { id: 'mtd', label: 'เดือนนี้' },
];

function localDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeForPreset(preset: RangePreset) {
  const today = new Date();
  const to = localDateInput(today);
  if (preset === 'mtd') {
    return { from: localDateInput(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  const days = preset === 'last7' ? 7 : preset === 'last30' ? 30 : 15;
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));
  return { from: localDateInput(from), to };
}

interface DrillTarget {
  branchId: number;
  branchCode: string;
  country: string;
}

interface Props {
  subtitle: string;
  failedMessage: string;
}

export function BranchCountryAnalyticsSection({ subtitle, failedMessage }: Props) {
  const [preset, setPreset] = useState<RangePreset>('mtd');
  const [data, setData] = useState<BranchCountryAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillTarget | null>(null);
  const [products, setProducts] = useState<BranchCountryProductsData | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const range = rangeForPreset(preset);
      const res = await getBranchCountryAnalytics({ ...range, force });
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : failedMessage);
    } finally {
      setLoading(false);
    }
  }, [failedMessage, preset]);

  const loadProducts = useCallback(
    async (target: DrillTarget, force = false) => {
      setProductsLoading(true);
      try {
        const range = data?.period ?? rangeForPreset(preset);
        const res = await getBranchCountryProducts({
          branchId: target.branchId,
          country: target.country,
          from: range.from,
          to: range.to,
          force,
        });
        setProducts(res);
      } catch {
        setProducts(null);
      } finally {
        setProductsLoading(false);
      }
    },
    [data?.period, preset],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (drill) void loadProducts(drill);
    else setProducts(null);
  }, [drill, loadProducts]);

  const handleCountryClick = (branchId: number, branchCode: string, country: string) => {
    const next = { branchId, branchCode, country };
    if (drill?.branchId === branchId && drill.country === country) {
      setDrill(null);
    } else {
      setDrill(next);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border text-xs font-medium">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPreset(opt.id)}
              className={`px-2.5 py-1.5 transition-colors ${
                preset === opt.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {data && (
          <span className="text-xs text-muted-foreground">
            {data.period.from} → {data.period.to}
            {data.dataQuality.source ? ` · ${data.dataQuality.source}` : ''}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {data?.dataQuality.warnings.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="space-y-1">
              {data.dataQuality.warnings.slice(0, 2).map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          กำลังโหลดข้อมูลประเทศรายสาขา…
        </div>
      ) : data ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">สาขา</TableHead>
                  <TableHead>Top 1</TableHead>
                  <TableHead>Top 2</TableHead>
                  <TableHead>Top 3</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">{b.shortcode || b.code}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[120px]">{b.name}</div>
                    </TableCell>
                    {[0, 1, 2].map((i) => {
                      const c = b.topCountries[i];
                      if (!c) {
                        return (
                          <TableCell key={i} className="text-xs text-muted-foreground">
                            —
                          </TableCell>
                        );
                      }
                      const active =
                        drill?.branchId === b.id && drill.country === c.country;
                      return (
                        <TableCell key={i}>
                          <button
                            type="button"
                            onClick={() =>
                              handleCountryClick(b.id, b.shortcode || b.code, c.country)
                            }
                            className={`w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                              active
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate font-medium">{c.country}</span>
                              {active ? (
                                <ChevronUp className="h-3 w-3 shrink-0 text-primary" />
                              ) : (
                                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                              )}
                            </div>
                            <div className="mt-0.5 text-muted-foreground">
                              {c.revenueSharePct}% · {baht(c.revenue)}
                            </div>
                          </button>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {drill && (
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-muted-foreground" />
                {drill.branchCode} · {drill.country} · สินค้าขายดี
              </p>
              {productsLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังโหลดสินค้า…
                </div>
              ) : products && products.products.length > 0 ? (
                <div className="space-y-2">
                  {products.products.slice(0, 10).map((p) => (
                    <div
                      key={p.sku}
                      className="flex items-center gap-3 rounded-md border bg-background px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.sku} · {p.category || 'ไม่ระบุหมวด'}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold">{baht(p.revenue)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.qty.toLocaleString('th-TH')} ชิ้น
                        </div>
                      </div>
                    </div>
                  ))}
                  {products.dataQuality.warnings.slice(0, 1).map((w) => (
                    <p key={w} className="text-[11px] text-amber-800">{w}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  ไม่พบสินค้าขายดีของ {drill.country} ที่สาขา {drill.branchCode} ในช่วงนี้
                </p>
              )}
            </div>
          )}

          {!data.dataQuality.reliable && data.branches.every((b) => b.topCountries.length === 0) && (
            <p className="text-sm text-muted-foreground">
              ยังไม่มีข้อมูลประเทศลูกค้ารายสาขา — ตรวจว่า ERP เปิด tourist API แล้ว
            </p>
          )}
        </>
      ) : null}

      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}
