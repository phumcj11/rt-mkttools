'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Loader2, RefreshCw, Search, Tag, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
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
  getProductCatalogDetail,
  getProductCatalogStatus,
  listProductCatalog,
  syncProductCatalog,
  type ProductCatalogFilter,
  type ProductCatalogItem,
  type ProductCatalogStatus,
} from '@/lib/products-api';

const FILTERS: { value: ProductCatalogFilter; label: string }[] = [
  { value: 'ready', label: 'พร้อมทำสื่อ' },
  { value: 'new_today', label: 'เข้าใหม่วันนี้' },
  { value: 'new', label: 'สินค้าใหม่' },
  { value: 'changed', label: 'เพิ่งเปลี่ยน' },
  { value: 'promo', label: 'มีโปรโมชั่น' },
  { value: 'low_gp', label: 'GP ต่ำ' },
  { value: 'missing_image', label: 'ไม่มีรูป' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'ทั้งหมด' },
];

const money = (value: number) =>
  new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value || 0);

const dateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';

export function ProductsView() {
  const [items, setItems] = useState<ProductCatalogItem[]>([]);
  const [status, setStatus] = useState<ProductCatalogStatus | null>(null);
  const [selected, setSelected] = useState<ProductCatalogItem | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<ProductCatalogFilter>('ready');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => ({ q, filter, page, limit: 50 }), [q, filter, page]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [catalog, nextStatus] = await Promise.all([
        listProductCatalog(query),
        getProductCatalogStatus(),
      ]);
      setItems(catalog.items);
      setTotal(catalog.total);
      setTotalPages(catalog.totalPages);
      setStatus(nextStatus);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลสินค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  async function runSync() {
    setSyncing(true);
    setError(null);
    try {
      await syncProductCatalog();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sync สินค้าไม่สำเร็จ');
    } finally {
      setSyncing(false);
    }
  }

  async function openDetail(item: ProductCatalogItem) {
    setSelected(item);
    try {
      const detail = await getProductCatalogDetail(item.sku);
      setSelected(detail);
    } catch {
      // Keep list data visible if detail endpoint fails.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Product Center</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString('th-TH')} SKU · Sync ล่าสุด {dateTime(status?.products.syncedAt)}
          </p>
        </div>
        <Button onClick={() => void runSync()} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sync สินค้า
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric title="สินค้าในระบบ" value={status?.products.count ?? 0} />
        <Metric title="Sales Snapshot" value={status?.sales.count ?? 0} />
        <Metric title="Promotion Snapshot" value={status?.promotions.count ?? 0} />
      </div>

      {status?.latestRun && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-xs text-muted-foreground">
            <Badge variant={status.latestRun.status === 'success' ? 'default' : status.latestRun.status === 'failed' ? 'destructive' : 'secondary'}>
              {status.latestRun.status}
            </Badge>
            <span>ใหม่ {status.latestRun.newCount}</span>
            <span>เปลี่ยน {status.latestRun.changedCount}</span>
            <span>Inactive {status.latestRun.inactiveCount}</span>
            <span>Sales {status.latestRun.salesCount}</span>
            <span>Promo {status.latestRun.promotionCount}</span>
            <span className="ml-auto">รอบล่าสุด {dateTime(status.latestRun.finishedAt ?? status.latestRun.startedAt)}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="ค้นหา SKU / ชื่อสินค้า / แบรนด์"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
              />
            </div>
            <NativeSelect
              className="sm:w-[180px]"
              value={filter}
              onChange={(e) => {
                setPage(1);
                setFilter(e.target.value as ProductCatalogFilter);
              }}
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </NativeSelect>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> โหลดสินค้า...
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              ไม่พบสินค้าในเงื่อนไขนี้
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[280px]">สินค้า</TableHead>
                    <TableHead>ราคา</TableHead>
                    <TableHead>ทุน</TableHead>
                    <TableHead>GP</TableHead>
                    <TableHead>ยอดขาย</TableHead>
                    <TableHead>โปร</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">ดู</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.sku}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-muted-foreground">
                                <Tag className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.sku} · {item.category || '-'} · {item.brand || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">฿{money(item.retailPrice)}</TableCell>
                      <TableCell className="tabular-nums">฿{money(item.costSales)}</TableCell>
                      <TableCell>
                        <GpBadge value={item.effectiveGpPct} />
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p className="tabular-nums">฿{money(item.revenue)}</p>
                          <p className="text-muted-foreground">{item.qtySold.toLocaleString('th-TH')} ชิ้น</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.activePromotionCount > 0 ? (
                          <Badge variant="secondary">{item.activePromotionCount} โปร</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Readiness item={item} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => void openDetail(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>หน้า {page}/{totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ก่อนหน้า
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                ถัดไป
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4" onClick={() => setSelected(null)}>
          <div
            className="ml-auto h-full max-w-xl overflow-auto rounded-xl bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <p className="text-xs text-muted-foreground">{selected.sku} · {selected.category} · {selected.brand}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="ราคาขาย" value={`฿${money(selected.retailPrice)}`} />
              <Detail label="ราคาทุน" value={`฿${money(selected.costSales)}`} />
              <Detail label="GP จากทุน" value={`${selected.marginGpPct.toFixed(1)}%`} />
              <Detail label="GP จากยอดขาย" value={`${selected.salesGpPct.toFixed(1)}%`} />
              <Detail label="ยอดขาย" value={`฿${money(selected.revenue)}`} />
              <Detail label="จำนวนขาย" value={`${selected.qtySold.toLocaleString('th-TH')} ชิ้น`} />
            </div>

            <div className="mt-4 rounded-lg border p-3">
              <p className="text-sm font-medium">โปรโมชั่นที่เกี่ยวข้อง</p>
              {!selected.promotions || selected.promotions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">ไม่มีโปรโมชั่น active</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {selected.promotions.map((promo) => (
                    <div key={promo.id} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <p className="font-medium">{promo.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {promo.typeName || promo.type} · ราคาโปร ฿{money(promo.promoPrice)}
                        {promo.remainingGpPct !== null ? ` · GP หลังโปร ${promo.remainingGpPct.toFixed(1)}%` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xl font-semibold tabular-nums">{value.toLocaleString('th-TH')}</p>
      </CardContent>
    </Card>
  );
}

function GpBadge({ value }: { value: number }) {
  const tone = value >= 35 ? 'text-green-700 border-green-300' : value >= 25 ? 'text-amber-700 border-amber-300' : 'text-red-700 border-red-300';
  return <Badge variant="outline" className={tone}>{value.toFixed(1)}%</Badge>;
}

function Readiness({ item }: { item: ProductCatalogItem }) {
  if (!item.isActive) return <Badge variant="outline">Inactive</Badge>;
  if (item.flags.length === 0) {
    return <Badge variant="default"><CheckCircle2 className="mr-1 h-3 w-3" />พร้อม</Badge>;
  }
  return <Badge variant="secondary">{item.flags[0]}</Badge>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
