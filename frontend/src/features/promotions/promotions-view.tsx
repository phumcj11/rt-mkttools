'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileImage,
  Gift,
  Loader2,
  RefreshCw,
  Sparkles,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getErpCategoryPerformance,
  getErpPromotions,
  getErpTopProducts,
  type ErpRangeOpts,
} from '@/lib/erp-api';
import type { ErpCategoryPerformance, ErpPromotion, ErpTopProduct } from '@/lib/types';

// ─── helpers ───────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : String(Math.round(n));

const thb = (n: number) => `฿${fmt(n)}`;

function buildRange(key: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (key === 'today') return { from: fmt(today), to: fmt(today) };
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 30;
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: fmt(from), to: fmt(today) };
}

function promoStatus(p: ErpPromotion): 'active' | 'ending-soon' | 'expired' {
  if (!p.dateStop) return 'active';
  const stop = new Date(p.dateStop);
  const now = new Date();
  if (stop < now) return 'expired';
  const diffDays = (stop.getTime() - now.getTime()) / 86400000;
  if (diffDays <= 7) return 'ending-soon';
  return 'active';
}

const RANGE_OPTIONS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7d', label: '7 วัน' },
  { key: '30d', label: '30 วัน' },
];

// ─── component ─────────────────────────────────────────────────────────────

export function PromotionsView() {
  const router = useRouter();

  const [rangeKey, setRangeKey] = useState('7d');
  const [promotions, setPromotions] = useState<ErpPromotion[]>([]);
  const [topProducts, setTopProducts] = useState<ErpTopProduct[]>([]);
  const [categories, setCategories] = useState<ErpCategoryPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const range = buildRange(rangeKey);
        const opts: ErpRangeOpts = { ...range, force };
        const days = rangeKey === 'today' ? 1 : rangeKey === '7d' ? 7 : 30;
        const [promos, products, cats] = await Promise.all([
          getErpPromotions(50, force),
          getErpTopProducts(days, 15, opts),
          getErpCategoryPerformance(days, opts),
        ]);
        setPromotions(promos ?? []);
        setTopProducts(products ?? []);
        setCategories(cats ?? []);
        setLastUpdate(new Date());
      } catch {
        setError('โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    },
    [rangeKey],
  );

  useEffect(() => {
    load();
  }, [load]);

  // ─── derived stats ───────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = promotions.filter((p) => promoStatus(p) === 'active');
    const endingSoon = promotions.filter((p) => promoStatus(p) === 'ending-soon');
    const expired = promotions.filter((p) => promoStatus(p) === 'expired');
    const totalProducts = promotions.reduce((s, p) => s + (p.productCount ?? 0), 0);
    return { active, endingSoon, expired, totalProducts };
  }, [promotions]);

  // ─── navigation helpers ───────────────────────────────────────────────────

  const goPostm = (promo: ErpPromotion) => {
    const params = new URLSearchParams({
      promo: promo.name,
      price: String(promo.promoPrice || promo.retailPrice || 0),
    });
    router.push(`/posm?${params}`);
  };

  const goContent = (promo: ErpPromotion) => {
    const params = new URLSearchParams({ promo: promo.name });
    router.push(`/content?${params}`);
  };

  const goPosmProduct = (product: ErpTopProduct) => {
    const params = new URLSearchParams({ product: product.name });
    router.push(`/posm?${params}`);
  };

  const goContentProduct = (product: ErpTopProduct) => {
    const params = new URLSearchParams({ product: product.name });
    router.push(`/content?${params}`);
  };

  // ─── status badge ────────────────────────────────────────────────────────

  const StatusBadge = ({ promo }: { promo: ErpPromotion }) => {
    const status = promoStatus(promo);
    if (status === 'active')
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="mr-1 h-3 w-3" />Active</Badge>;
    if (status === 'ending-soon')
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><Clock className="mr-1 h-3 w-3" />ใกล้หมด</Badge>;
    return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">หมดแล้ว</Badge>;
  };

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Gift className="h-6 w-6 text-primary" />
            Promotion Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            วิเคราะห์โปรโมชัน ยอดขาย หมวดหมู่ และสร้างสื่อการตลาดทันที
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              อัปเดต {lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarDays className="mr-2 h-4 w-4" />
                {RANGE_OPTIONS.find((r) => r.key === rangeKey)?.label}
                <ChevronDown className="ml-2 h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={rangeKey} onValueChange={setRangeKey}>
                {RANGE_OPTIONS.map((r) => (
                  <DropdownMenuRadioItem key={r.key} value={r.key}>
                    {r.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && promotions.length === 0 && (
        <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>กำลังโหลดข้อมูลโปรโมชัน...</span>
        </div>
      )}

      {/* KPI cards */}
      {!loading || promotions.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              title="โปร Active"
              value={String(stats.active.length)}
              icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
              sub="รายการที่ยังใช้งานได้"
            />
            <KpiCard
              title="ใกล้หมดอายุ"
              value={String(stats.endingSoon.length)}
              icon={<Clock className="h-5 w-5 text-amber-500" />}
              sub="ภายใน 7 วัน"
            />
            <KpiCard
              title="สินค้าในโปร"
              value={String(stats.totalProducts)}
              icon={<Tag className="h-5 w-5 text-primary" />}
              sub="รวมทุกโปรที่ active"
            />
            <KpiCard
              title="สินค้าขายดี"
              value={String(topProducts.length)}
              icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
              sub={`ใน${RANGE_OPTIONS.find((r) => r.key === rangeKey)?.label}`}
            />
          </div>

          {/* ─── Active Promotions Table ─────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-4 w-4 text-primary" />
                รายการโปรโมชัน ({promotions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {promotions.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                  ไม่มีข้อมูลโปรโมชัน
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ชื่อโปร</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead>วันเริ่ม-สิ้นสุด</TableHead>
                        <TableHead className="text-right">สินค้า</TableHead>
                        <TableHead className="text-right">ราคาโปร</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {promotions.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.typeName || p.type || '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {p.dateStart || '—'} → {p.dateStop || '—'}
                          </TableCell>
                          <TableCell className="text-right">{p.productCount || '—'}</TableCell>
                          <TableCell className="text-right">
                            {p.promoPrice ? (
                              <span className="font-medium text-primary">{thb(p.promoPrice)}</span>
                            ) : p.retailPrice ? (
                              <span className="text-muted-foreground">{thb(p.retailPrice)}</span>
                            ) : (
                              '—'
                            )}
                            {p.discountPct > 0 && (
                              <span className="ml-1 text-xs text-green-600">-{p.discountPct}%</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge promo={p} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => goPostm(p)}
                                title="สร้าง POSM"
                              >
                                <FileImage className="mr-1 h-3 w-3" />
                                POSM
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => goContent(p)}
                                title="สร้างโพสต์"
                              >
                                <Sparkles className="mr-1 h-3 w-3" />
                                Caption
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Two-column: Top Products + Category ─────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Top Products */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  สินค้าขายดี — ควรทำ POSM/โพสต์
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {topProducts.length === 0 ? (
                  <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                    ไม่มีข้อมูล
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>สินค้า</TableHead>
                          <TableHead className="text-right">ยอดขาย</TableHead>
                          <TableHead className="text-right">GP%</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topProducts.slice(0, 10).map((p, i) => (
                          <TableRow key={p.sku || i}>
                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="max-w-[180px] truncate font-medium" title={p.name}>
                              {p.name}
                            </TableCell>
                            <TableCell className="text-right">{thb(p.revenue)}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  p.gpPct >= 30
                                    ? 'text-green-600'
                                    : p.gpPct >= 15
                                    ? 'text-amber-600'
                                    : 'text-red-500'
                                }
                              >
                                {p.gpPct}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-xs"
                                  onClick={() => goPosmProduct(p)}
                                >
                                  <FileImage className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-xs"
                                  onClick={() => goContentProduct(p)}
                                >
                                  <Sparkles className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Performance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart2 className="h-4 w-4 text-purple-500" />
                  หมวดหมู่ขายดี — โอกาสจัดโปรเพิ่ม
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {categories.length === 0 ? (
                  <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                    ไม่มีข้อมูล
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>หมวด</TableHead>
                          <TableHead className="text-right">ยอดขาย</TableHead>
                          <TableHead className="text-right">สินค้า</TableHead>
                          <TableHead className="text-right">GP%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.slice(0, 10).map((c, i) => (
                          <TableRow key={c.category}>
                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-medium">{c.category}</TableCell>
                            <TableCell className="text-right">{thb(c.revenue)}</TableCell>
                            <TableCell className="text-right">{c.productCount}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  c.gpPct >= 30
                                    ? 'text-green-600'
                                    : c.gpPct >= 15
                                    ? 'text-amber-600'
                                    : 'text-red-500'
                                }
                              >
                                {c.gpPct}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Marketing Actions Panel ─────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Marketing Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ActionCard
                  icon={<FileImage className="h-8 w-8 text-blue-500" />}
                  title="สร้าง POSM"
                  desc="ป้ายราคา, Shelf Talker, โปสเตอร์ A4 จากโปรที่เลือก"
                  onClick={() => router.push('/posm')}
                />
                <ActionCard
                  icon={<Sparkles className="h-8 w-8 text-purple-500" />}
                  title="สร้างโพสต์ AI"
                  desc="Caption LINE, Facebook, TikTok จากโปรหรือสินค้าขายดี"
                  onClick={() => router.push('/content')}
                />
                <ActionCard
                  icon={<TrendingUp className="h-8 w-8 text-green-500" />}
                  title="Social Listening"
                  desc="ดูว่าคนพูดถึงสินค้าในโปรอย่างไร"
                  onClick={() => router.push('/social')}
                />
                <ActionCard
                  icon={<BarChart2 className="h-8 w-8 text-amber-500" />}
                  title="Executive Dashboard"
                  desc="ดูภาพรวมยอดขายและเปรียบเทียบผล"
                  onClick={() => router.push('/dashboard')}
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

// ─── sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
          <div className="rounded-full bg-muted p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
    >
      {icon}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="mt-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </button>
  );
}
