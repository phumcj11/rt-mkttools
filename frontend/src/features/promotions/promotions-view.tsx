'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Clock,
  FileImage,
  Gift,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getErpCampaignCandidates,
  getErpCategoryPerformance,
  getErpProducts,
  getErpPromotions,
  getErpTopProducts,
  type ErpRangeOpts,
} from '@/lib/erp-api';
import type {
  ErpCampaignCandidate,
  ErpCategoryPerformance,
  ErpProductListItem,
  ErpPromotion,
  ErpTopProduct,
} from '@/lib/types';

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
  const fmtD = (d: Date) => d.toISOString().slice(0, 10);
  if (key === 'today') return { from: fmtD(today), to: fmtD(today) };
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 30;
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: fmtD(from), to: fmtD(today) };
}

function promoStatus(p: ErpPromotion): 'active' | 'ending-soon' | 'expired' {
  if (!p.dateStop) return 'active';
  const stop = new Date(p.dateStop);
  const now = new Date();
  if (stop < now) return 'expired';
  return (stop.getTime() - now.getTime()) / 86400000 <= 7 ? 'ending-soon' : 'active';
}

const RANGE_OPTIONS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7d',   label: '7 วัน'  },
  { key: '30d',  label: '30 วัน' },
];

const LOOKBACK_OPTIONS = [
  { key: '30',  label: '30 วัน' },
  { key: '60',  label: '60 วัน' },
  { key: '90',  label: '90 วัน' },
];

const ABC_OPTIONS = [
  { key: '',    label: 'ทุก ABC' },
  { key: 'ACOM,BCOM', label: 'A + B เท่านั้น' },
  { key: 'ACOM', label: 'A เท่านั้น' },
];

type Tab = 'overview' | 'planner' | 'products';

// ─── main component ────────────────────────────────────────────────────────

export function PromotionsView() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="-mx-4 -mt-4 mb-2 flex flex-col gap-0 lg:-mx-6 lg:-mt-6">
      {/* Page header — full-bleed within dashboard main */}
      <div className="border-b bg-card px-4 pt-5 pb-0 lg:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Gift className="h-6 w-6 text-primary" />
          Promotion Center
        </h1>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          ภาพรวมโปรโมชัน · วางแผน Campaign · ค้นหาสินค้า
        </p>

        {/* Tab bar — pill style, always visible */}
        <div className="mb-4 inline-flex rounded-lg border bg-muted/60 p-1">
          {(
            [
              { key: 'overview', label: 'Overview', icon: BarChart2 },
              { key: 'planner',  label: 'Campaign Planner', icon: Wand2 },
              { key: 'products', label: 'Products', icon: Tag },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 lg:px-6">
        {tab === 'overview'  && <OverviewTab router={router} />}
        {tab === 'planner'   && <CampaignPlannerTab router={router} />}
        {tab === 'products'  && <ProductsTab router={router} />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// TAB: Overview (previous content)
// ──────────────────────────────────────────────────────────────────────────

function OverviewTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [rangeKey, setRangeKey] = useState('7d');
  const [promotions, setPromotions] = useState<ErpPromotion[]>([]);
  const [topProducts, setTopProducts] = useState<ErpTopProduct[]>([]);
  const [categories, setCategories] = useState<ErpCategoryPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async (force = false) => {
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
  }, [rangeKey]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const active    = promotions.filter((p) => promoStatus(p) === 'active');
    const endingSoon = promotions.filter((p) => promoStatus(p) === 'ending-soon');
    const totalProducts = promotions.reduce((s, p) => s + (p.productCount ?? 0), 0);
    return { active, endingSoon, totalProducts };
  }, [promotions]);

  const StatusBadge = ({ promo }: { promo: ErpPromotion }) => {
    const st = promoStatus(promo);
    if (st === 'active')
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="mr-1 h-3 w-3" />Active</Badge>;
    if (st === 'ending-soon')
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><Clock className="mr-1 h-3 w-3" />ใกล้หมด</Badge>;
    return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">หมดแล้ว</Badge>;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Range + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              อัปเดต {lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <div className="flex rounded-md border">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                  rangeKey === r.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >{r.label}</button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {loading && promotions.length === 0 ? (
        <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />กำลังโหลด...
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard title="โปร Active" value={String(stats.active.length)} icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} sub="รายการที่ใช้งานได้" />
            <KpiCard title="ใกล้หมดอายุ" value={String(stats.endingSoon.length)} icon={<Clock className="h-5 w-5 text-amber-500" />} sub="ภายใน 7 วัน" />
            <KpiCard title="สินค้าในโปร" value={String(stats.totalProducts)} icon={<Tag className="h-5 w-5 text-primary" />} sub="รวมทุกโปร active" />
            <KpiCard title="สินค้าขายดี" value={String(topProducts.length)} icon={<TrendingUp className="h-5 w-5 text-blue-500" />} sub={`ใน${RANGE_OPTIONS.find((r) => r.key === rangeKey)?.label}`} />
          </div>

          {/* Promotions table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-4 w-4 text-primary" />
                รายการโปรโมชัน ({promotions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {promotions.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูลโปรโมชัน</div>
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
                          <TableCell className="text-sm text-muted-foreground">{p.typeName || p.type || '—'}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{p.dateStart || '—'} → {p.dateStop || '—'}</TableCell>
                          <TableCell className="text-right">{p.productCount || '—'}</TableCell>
                          <TableCell className="text-right">
                            {p.promoPrice ? <span className="font-medium text-primary">{thb(p.promoPrice)}</span>
                              : p.retailPrice ? <span className="text-muted-foreground">{thb(p.retailPrice)}</span> : '—'}
                            {p.discountPct > 0 && <span className="ml-1 text-xs text-green-600">-{p.discountPct}%</span>}
                          </TableCell>
                          <TableCell><StatusBadge promo={p} /></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => router.push(`/posm?promo=${encodeURIComponent(p.name)}&price=${p.promoPrice || p.retailPrice || 0}`)}>
                                <FileImage className="mr-1 h-3 w-3" />POSM
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => router.push(`/content?promo=${encodeURIComponent(p.name)}`)}>
                                <Sparkles className="mr-1 h-3 w-3" />Caption
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

          {/* Top products + categories */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-blue-500" />สินค้าขายดี
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>สินค้า</TableHead><TableHead className="text-right">ยอดขาย</TableHead><TableHead className="text-right">GP%</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {topProducts.slice(0, 10).map((p, i) => (
                        <TableRow key={p.sku || i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="max-w-[160px] truncate font-medium" title={p.name}>{p.name}</TableCell>
                          <TableCell className="text-right">{thb(p.revenue)}</TableCell>
                          <TableCell className="text-right">
                            <span className={p.gpPct >= 30 ? 'text-green-600' : p.gpPct >= 15 ? 'text-amber-600' : 'text-red-500'}>{p.gpPct}%</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => router.push(`/posm?product=${encodeURIComponent(p.name)}`)}>
                                <FileImage className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => router.push(`/content?product=${encodeURIComponent(p.name)}`)}>
                                <Sparkles className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart2 className="h-4 w-4 text-purple-500" />หมวดหมู่ขายดี
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>หมวด</TableHead><TableHead className="text-right">ยอดขาย</TableHead><TableHead className="text-right">สินค้า</TableHead><TableHead className="text-right">GP%</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {categories.slice(0, 10).map((c, i) => (
                        <TableRow key={c.category}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{c.category}</TableCell>
                          <TableCell className="text-right">{thb(c.revenue)}</TableCell>
                          <TableCell className="text-right">{c.productCount}</TableCell>
                          <TableCell className="text-right">
                            <span className={c.gpPct >= 30 ? 'text-green-600' : c.gpPct >= 15 ? 'text-amber-600' : 'text-red-500'}>{c.gpPct}%</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />Marketing Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ActionCard icon={<FileImage className="h-8 w-8 text-blue-500" />} title="สร้าง POSM" desc="ป้ายราคา, Shelf Talker, โปสเตอร์" onClick={() => router.push('/posm')} />
                <ActionCard icon={<Sparkles className="h-8 w-8 text-purple-500" />} title="สร้างโพสต์ AI" desc="Caption LINE, Facebook, TikTok" onClick={() => router.push('/content')} />
                <ActionCard icon={<TrendingUp className="h-8 w-8 text-green-500" />} title="Social Listening" desc="คนพูดถึงสินค้าอย่างไร" onClick={() => router.push('/social')} />
                <ActionCard icon={<BarChart2 className="h-8 w-8 text-amber-500" />} title="Executive Dashboard" desc="ภาพรวมยอดขาย" onClick={() => router.push('/dashboard')} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// TAB: Campaign Planner
// ──────────────────────────────────────────────────────────────────────────

function CampaignPlannerTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [campaignName, setCampaignName] = useState('Buffet 100');
  const [targetPrice, setTargetPrice]   = useState('100');
  const [minGpPct, setMinGpPct]         = useState('30');
  const [lookback, setLookback]         = useState('30');
  const [abcFilter, setAbcFilter]       = useState('');

  const [candidates, setCandidates] = useState<ErpCampaignCandidate[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [ran, setRan]               = useState(false);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setRan(false);
    try {
      const today = new Date();
      const from  = new Date(today);
      from.setDate(from.getDate() - (Number(lookback) - 1));
      const fmtD  = (d: Date) => d.toISOString().slice(0, 10);
      const data = await getErpCampaignCandidates({
        targetPrice: Number(targetPrice) || 100,
        minGpPct:    Number(minGpPct)    || 30,
        from: fmtD(from),
        to:   fmtD(today),
        abc:  abcFilter || undefined,
        limit: 60,
      });
      setCandidates(data ?? []);
      setRan(true);
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ — กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 70 ? 'text-green-600 font-bold' : s >= 40 ? 'text-amber-600' : 'text-muted-foreground';

  return (
    <div className="flex flex-col gap-6">
      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-primary" />
            วางแผน Campaign
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Label htmlFor="campaign-name">ชื่อ Campaign</Label>
              <Input
                id="campaign-name"
                placeholder="เช่น Buffet 100, 9.9, Songkran Sale"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="target-price">ราคาเป้าหมาย (บาท)</Label>
              <Input
                id="target-price"
                type="number"
                min={0}
                placeholder="100"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="min-gp">GP ขั้นต่ำ (%)</Label>
              <Input
                id="min-gp"
                type="number"
                min={0}
                max={100}
                placeholder="30"
                value={minGpPct}
                onChange={(e) => setMinGpPct(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">ใช้ข้อมูลย้อนหลัง</Label>
              <div className="mt-1 flex rounded-md border">
                {LOOKBACK_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setLookback(o.key)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                      lookback === o.key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >{o.label}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">ABC Filter</Label>
              <div className="mt-1 flex rounded-md border">
                {ABC_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setAbcFilter(o.key)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                      abcFilter === o.key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >{o.label}</button>
                ))}
              </div>
            </div>
            <Button onClick={handleRun} disabled={loading} className="ml-auto gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {loading ? 'กำลังวิเคราะห์...' : 'วิเคราะห์สินค้าเข้าร่วม'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Results */}
      {ran && !loading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-amber-500" />
              สินค้าแนะนำสำหรับ &quot;{campaignName}&quot; — GP ≥ {minGpPct}%
              <Badge className="ml-2 bg-primary/10 text-primary">{candidates.length} รายการ</Badge>
              {candidates.filter((c) => c.fitsTargetPrice).length > 0 && (
                <Badge className="ml-1 bg-green-100 text-green-800">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {candidates.filter((c) => c.fitsTargetPrice).length} เข้าเกณฑ์ ฿{targetPrice}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {candidates.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                ไม่มีสินค้าที่ผ่านเงื่อนไข — ลองลด GP ขั้นต่ำหรือขยายช่วงวันที่
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>สินค้า / หมวด</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">GP%</TableHead>
                      <TableHead className="text-right">ราคาขาย</TableHead>
                      <TableHead className="text-right">แนะนำ Buffet</TableHead>
                      <TableHead className="text-right">ยอดขาย</TableHead>
                      <TableHead>ABC</TableHead>
                      <TableHead>เหตุผล / คำเตือน</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c, i) => (
                      <TableRow key={c.sku} className={c.fitsTargetPrice ? 'bg-green-50/40' : ''}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {c.fitsTargetPrice
                              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                              : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                            <div>
                              <div className="font-medium">{c.name}</div>
                              <div className="text-xs text-muted-foreground">{c.sku} · {c.category}{c.brand ? ` · ${c.brand}` : ''}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right text-lg ${scoreColor(c.score)}`}>{c.score}</TableCell>
                        <TableCell className="text-right">
                          <span className={c.gpPct >= 40 ? 'font-bold text-green-600' : c.gpPct >= 30 ? 'text-green-600' : 'text-amber-600'}>
                            {c.gpPct.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.retailPrice > 0 ? (
                            <span className={c.fitsTargetPrice ? 'font-semibold text-green-700' : 'text-amber-600'}>
                              ฿{c.retailPrice.toLocaleString()}
                              {!c.fitsTargetPrice && c.discountNeeded > 0 && (
                                <span className="ml-1 text-xs text-amber-500">(-{c.discountNeeded}%)</span>
                              )}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.suggestedBuffetPrice > 0 ? (
                            <span className="font-semibold text-primary">฿{c.suggestedBuffetPrice}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">{thb(c.revenue)}</TableCell>
                        <TableCell>
                          <span className={
                            c.abcCompany === 'ACOM' ? 'font-bold text-primary' :
                            c.abcCompany === 'BCOM' ? 'text-blue-600' :
                            'text-muted-foreground'
                          }>{c.abcCompany || '—'}</span>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <div className="flex flex-wrap gap-1">
                            {c.reasons.map((r) => (
                              <span key={r} className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                                ✓ {r}
                              </span>
                            ))}
                            {c.warnings.map((w) => (
                              <span key={w} className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                ⚠ {w}
                              </span>
                            ))}
                            {c.hasExistingPromo && (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                มีโปร ERP อยู่แล้ว
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm" variant="outline" className="h-7 px-2 text-xs"
                              onClick={() => router.push(`/posm?product=${encodeURIComponent(c.name)}&price=${c.suggestedBuffetPrice || c.retailPrice}&promo=${encodeURIComponent(campaignName)}`)}
                            >
                              <FileImage className="mr-1 h-3 w-3" />POSM
                            </Button>
                            <Button
                              size="sm" variant="outline" className="h-7 px-2 text-xs"
                              onClick={() => router.push(`/content?product=${encodeURIComponent(c.name)}&promo=${encodeURIComponent(campaignName)}`)}
                            >
                              <Sparkles className="mr-1 h-3 w-3" />Caption
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
      )}

      {/* Instructions when not yet run */}
      {!ran && !loading && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Wand2 className="h-10 w-10 opacity-30" />
          <p className="text-sm">
            กรอกชื่อ Campaign, ราคาเป้าหมาย และ GP ขั้นต่ำ แล้วกด
            <strong className="text-foreground"> วิเคราะห์สินค้าเข้าร่วม</strong>
          </p>
          <p className="text-xs">ระบบจะดึงข้อมูลยอดขาย GP และ ABC จาก ERP มา rank สินค้าที่เหมาะสมให้ทันที</p>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// TAB: Products (browse & filter ERP product catalog)
// ──────────────────────────────────────────────────────────────────────────

function ProductsTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [search, setSearch]       = useState('');
  const [abcFilter, setAbcFilter] = useState('');
  const [hasStock, setHasStock]   = useState(false);
  const [products, setProducts]   = useState<ErpProductListItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [page, setPage]           = useState(1);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (s: string, abc: string, stock: boolean, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getErpProducts({
        search:   s || undefined,
        abc:      abc || undefined,
        hasStock: stock ? true : undefined,
        page:     p,
        limit:    50,
      });
      setProducts(data ?? []);
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { doSearch('', '', false, 1); }, [doSearch]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v, abcFilter, hasStock, 1), 400);
  };

  const handleFilter = (abc: string, stock: boolean) => {
    setAbcFilter(abc);
    setHasStock(stock);
    setPage(1);
    doSearch(search, abc, stock, 1);
  };

  const abcColor = (abc: string) =>
    abc === 'ACOM' ? 'font-bold text-primary' : abc === 'BCOM' ? 'text-blue-600' : 'text-muted-foreground';

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อสินค้า / SKU / barcode"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-md border">
          {[
            { key: '', label: 'ทุก ABC' },
            { key: 'ACOM', label: 'A' },
            { key: 'BCOM', label: 'B' },
            { key: 'ACOM,BCOM', label: 'A+B' },
          ].map((o) => (
            <button
              key={o.key}
              onClick={() => handleFilter(o.key, hasStock)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                abcFilter === o.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >{o.label}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasStock}
            onChange={(e) => handleFilter(abcFilter, e.target.checked)}
            className="h-4 w-4 rounded border"
          />
          มีสต็อก
        </label>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Products table */}
      <Card>
        <CardContent className="p-0">
          {products.length === 0 && !loading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              ไม่พบสินค้า
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead>หมวด</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-center">ABC</TableHead>
                    <TableHead className="text-right">ราคา</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="font-medium">{p.name}</div>
                        {p.productType && <div className="text-xs text-muted-foreground">{p.productType}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{p.category || '—'}</TableCell>
                      <TableCell className="text-sm">{p.brand || '—'}</TableCell>
                      <TableCell className={`text-center ${abcColor(p.abcCompany)}`}>
                        {p.abcCompany || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.retailPrice ? thb(p.retailPrice) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm" variant="ghost" className="h-6 px-1.5 text-xs"
                            onClick={() => router.push(`/posm?product=${encodeURIComponent(p.name)}`)}
                            title="สร้าง POSM"
                          >
                            <FileImage className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-6 px-1.5 text-xs"
                            onClick={() => router.push(`/content?product=${encodeURIComponent(p.name)}`)}
                            title="สร้างโพสต์"
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

      {/* Pagination */}
      {products.length === 50 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); doSearch(search, abcFilter, hasStock, p); }}>
            ก่อนหน้า
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">หน้า {page}</span>
          <Button variant="outline" size="sm" onClick={() => { const p = page + 1; setPage(p); doSearch(search, abcFilter, hasStock, p); }}>
            ถัดไป
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── shared sub-components ──────────────────────────────────────────────────

function KpiCard({ title, value, icon, sub }: { title: string; value: string; icon: React.ReactNode; sub: string }) {
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

function ActionCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex flex-col items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent">
      {icon}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="mt-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </button>
  );
}
