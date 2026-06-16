'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  getCachedCampaigns,
  getErpCampaignCandidates,
  getErpCategoryPerformance,
  getErpProducts,
  getErpPromotions,
  getErpSyncStatus,
  getErpTopProducts,
  getSkuPromotionSteps,
  syncErpCampaigns,
  syncErpProducts,
  syncErpSales,
  forceSyncSkuPromotion,
  type ErpRangeOpts,
} from '@/lib/erp-api';
import type {
  CampaignAnalysisSummary,
  ErpCacheStatus,
  ErpCampaignCacheItem,
  ErpCampaignCandidate,
  ErpCategoryPerformance,
  ErpProductListItem,
  ErpPromotion,
  ErpTopProduct,
  SkuPromotionStep,
  SkuPromotionLookupResult,
} from '@/lib/types';
import { ProductDetailDrawer } from './ProductDetailDrawer';

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

type Tab = 'overview' | 'planner' | 'products' | 'campaigns' | 'sku-lookup';

// ─── main component ────────────────────────────────────────────────────────

export function PromotionsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') ?? 'overview') as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);

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
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-muted/60 p-1 w-fit">
          {(
            [
              { key: 'overview',   label: 'Overview',          icon: BarChart2 },
              { key: 'campaigns',  label: 'ERP Campaigns',     icon: Gift },
              { key: 'sku-lookup', label: 'ค้น SKU',           icon: Search },
              { key: 'planner',    label: 'Campaign Planner',  icon: Wand2 },
              { key: 'products',   label: 'Products',          icon: Tag },
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
        {tab === 'overview'   && <OverviewTab router={router} />}
        {tab === 'campaigns'  && <CampaignsTab />}
        {tab === 'sku-lookup' && <SkuLookupTab />}
        {tab === 'planner'    && <CampaignPlannerTab router={router} />}
        {tab === 'products'   && <ProductsTab router={router} />}
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
  const [pieceQty, setPieceQty]         = useState('1');
  const [targetPrice, setTargetPrice]   = useState('100');
  const [minGpPct, setMinGpPct]         = useState('30');
  const [lookback, setLookback]         = useState('30');
  const [abcFilter, setAbcFilter]       = useState('');
  const [withAi, setWithAi]             = useState(true);

  const qtyNum = Math.max(1, Number(pieceQty) || 1);
  const priceNum = Number(targetPrice) || 100;
  const priceLabel = qtyNum > 1 ? `${qtyNum} ชิ้น ฿${priceNum}` : `฿${priceNum}`;
  const perPiece = Math.round((priceNum / qtyNum) * 100) / 100;

  const [candidates, setCandidates]   = useState<ErpCampaignCandidate[]>([]);
  const [summary, setSummary]         = useState<CampaignAnalysisSummary | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [ran, setRan]                 = useState(false);

  // Detail drawer
  const [detailSku, setDetailSku] = useState<string | null>(null);

  // ERP DB cache status
  const [cacheStatus, setCacheStatus] = useState<ErpCacheStatus | null>(null);
  const [syncing, setSyncing]         = useState(false);
  const [syncingCampaigns, setSyncingCampaigns] = useState(false);

  // Cached campaigns indexed by SKU for planner badges
  const [skuCampaignMap, setSkuCampaignMap] = useState<Map<string, ErpCampaignCacheItem[]>>(new Map());

  useEffect(() => {
    getErpSyncStatus().then(setCacheStatus).catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await Promise.all([syncErpProducts(), syncErpSales(90)]);
      const status = await getErpSyncStatus();
      setCacheStatus(status);
    } catch {
      // silent
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncCampaigns = async () => {
    setSyncingCampaigns(true);
    try {
      await syncErpCampaigns();
      const status = await getErpSyncStatus();
      setCacheStatus(status);
      await loadCampaignMap();
    } catch {
      // silent
    } finally {
      setSyncingCampaigns(false);
    }
  };

  const loadCampaignMap = async () => {
    try {
      const camps = await getCachedCampaigns(false);
      const map = new Map<string, ErpCampaignCacheItem[]>();
      camps.forEach((c) => {
        (c.products ?? []).forEach((p) => {
          const existing = map.get(p.sku) ?? [];
          existing.push(c);
          map.set(p.sku, existing);
        });
      });
      setSkuCampaignMap(map);
    } catch {
      // non-fatal
    }
  };

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setRan(false);
    setSummary(null);
    try {
      const today = new Date();
      const from  = new Date(today);
      from.setDate(from.getDate() - (Number(lookback) - 1));
      const fmtD  = (d: Date) => d.toISOString().slice(0, 10);
      const [result] = await Promise.all([
        getErpCampaignCandidates({
          targetPrice:  priceNum,
          pieceQty:     qtyNum,
          minGpPct:     Number(minGpPct)    || 30,
          campaignName: campaignName || 'Campaign',
          from: fmtD(from),
          to:   fmtD(today),
          abc:  abcFilter || undefined,
          limit: 80,
          withAi,
        }),
        loadCampaignMap(),
      ]);
      setCandidates(result?.candidates ?? []);
      setSummary(result?.summary ?? null);
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
      {/* ERP cache status bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">ข้อมูล ERP:</span>
        {cacheStatus ? (
          <>
            <span>
              สินค้า {cacheStatus.products.count.toLocaleString()} รายการ
              {cacheStatus.products.syncedAt
                ? ` · ล่าสุด ${new Date(cacheStatus.products.syncedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`
                : ' · ยังไม่ได้ sync'}
            </span>
            <span>·</span>
            <span>
              ยอดขาย {cacheStatus.sales.count.toLocaleString()} SKU
              {cacheStatus.sales.syncedAt
                ? ` · ล่าสุด ${new Date(cacheStatus.sales.syncedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`
                : ' · ยังไม่ได้ sync'}
            </span>
            {cacheStatus.campaigns !== undefined && (
              <>
                <span>·</span>
                <span className={cacheStatus.campaigns.count > 0 ? 'text-amber-700 dark:text-amber-400 font-medium' : ''}>
                  Campaigns {cacheStatus.campaigns.count.toLocaleString()} รายการ
                  {cacheStatus.campaigns.syncedAt
                    ? ` · ล่าสุด ${new Date(cacheStatus.campaigns.syncedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`
                    : ' · ยังไม่ได้ sync'}
                </span>
              </>
            )}
          </>
        ) : (
          <span>กำลังตรวจสอบ…</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sync…' : 'Sync สินค้า'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
            onClick={handleSyncCampaigns}
            disabled={syncingCampaigns}
          >
            <RefreshCw className={`h-3 w-3 ${syncingCampaigns ? 'animate-spin' : ''}`} />
            {syncingCampaigns ? 'Sync…' : 'Sync Campaigns'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-primary" />
            วางแผน Campaign
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label htmlFor="campaign-name">ชื่อ Campaign</Label>
              <Input
                id="campaign-name"
                placeholder="เช่น Buffet 3 ชิ้น 100, 9.9 Sale"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="piece-qty">จำนวนชิ้น</Label>
              <Input
                id="piece-qty"
                type="number"
                min={1}
                placeholder="1"
                value={pieceQty}
                onChange={(e) => setPieceQty(e.target.value)}
                className="mt-1"
              />
              {qtyNum > 1 && (
                <p className="mt-0.5 text-xs text-muted-foreground">≈ ฿{perPiece}/ชิ้น</p>
              )}
            </div>
            <div>
              <Label htmlFor="target-price">ราคารวม (บาท)</Label>
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
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setWithAi((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  withAi
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground hover:bg-accent'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                AI วิเคราะห์
              </button>
              <Button onClick={handleRun} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {loading ? 'กำลังวิเคราะห์...' : 'วิเคราะห์สินค้าเข้าร่วม'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* AI Summary Panel */}
      {ran && !loading && summary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              {summary.source === 'ai' ? 'AI แนะนำ' : 'สรุปแคมเปญ'} — &quot;{campaignName}&quot;
              <Badge className="ml-auto text-xs">{summary.source === 'ai' ? 'GPT' : 'Auto'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {summary.insights.map((ins, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {ins}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {ran && !loading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-amber-500" />
              สินค้าที่ {priceLabel} GP ≥ {minGpPct}%
              <Badge className="ml-2 bg-primary/10 text-primary">{candidates.length} รายการ</Badge>
              {candidates.filter((c) => c.eligibleForTarget && c.dataQuality.length === 0).length > 0 && (
                <Badge className="ml-1 bg-green-100 text-green-800">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {candidates.filter((c) => c.eligibleForTarget && c.dataQuality.length === 0).length} ผ่านเกณฑ์
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
                      <TableHead>สินค้า</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">GP {priceLabel}</TableHead>
                      <TableHead className="text-right">ราคา/ชิ้น</TableHead>
                      <TableHead className="text-right">ราคาขั้นต่ำ</TableHead>
                      <TableHead className="text-right">ยอดขาย</TableHead>
                      <TableHead>ABC</TableHead>
                      <TableHead>เหตุผล / คำเตือน</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c, i) => (
                      <TableRow key={c.sku} className={c.eligibleForTarget && c.dataQuality.length === 0 ? 'bg-green-50/40' : ''}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            {c.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.imageUrl}
                                alt={c.name}
                                className="h-10 w-10 shrink-0 rounded-md border object-cover bg-muted"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                                N/A
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                {c.eligibleForTarget && c.dataQuality.length === 0
                                  ? <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />
                                  : c.dataQuality.includes('no_cost')
                                  ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
                                  : null}
                                <button
                                  type="button"
                                  className="font-medium leading-tight truncate hover:underline hover:text-primary text-left"
                                  onClick={() => setDetailSku(c.sku)}
                                  title="ดูรายละเอียดสินค้า"
                                >
                                  {c.name}
                                </button>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {c.sku}{c.category ? ` · ${c.category}` : ''}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right text-lg ${scoreColor(c.score)}`}>{c.score}</TableCell>
                        <TableCell className="text-right">
                          <span className={
                            c.effectiveGpPct >= 40 ? 'font-bold text-green-600' :
                            c.effectiveGpPct >= Number(minGpPct) ? 'text-green-600' : 'text-amber-600'
                          }>
                            {c.effectiveGpPct.toFixed(1)}%
                          </span>
                          {c.campaignGpPct !== null && c.effectiveGpPct > c.campaignGpPct && (
                            <div className="text-[10px] text-muted-foreground">คำนวณ {c.campaignGpPct.toFixed(0)}%</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.retailPrice > 0 ? (
                            <span className={c.retailPrice <= perPiece ? 'text-green-700 font-medium' : 'text-muted-foreground'}>
                              ฿{c.retailPrice.toLocaleString()}
                              {c.discountNeeded > 0 && (
                                <span className="ml-1 text-xs text-amber-500">(-{c.discountNeeded}%)</span>
                              )}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.minSellPrice > 0 ? (
                            <span className={`font-semibold ${c.minSellPrice <= priceNum ? 'text-primary' : 'text-amber-600'}`}>
                              ฿{c.minSellPrice.toLocaleString()}
                            </span>
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
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-1 flex-wrap">
                              <Button
                                size="sm" variant="outline" className="h-7 px-2 text-xs"
                                onClick={() => router.push(`/signs?sku=${encodeURIComponent(c.sku)}`)}
                              >
                                <ArrowRight className="mr-1 h-3 w-3" />ป้าย
                              </Button>
                              <Button
                                size="sm" variant="outline" className="h-7 px-2 text-xs"
                                onClick={() => router.push(`/posm?product=${encodeURIComponent(c.name)}&price=${c.minSellPrice || c.retailPrice}&promo=${encodeURIComponent(campaignName)}`)}
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
                            {(skuCampaignMap.get(c.sku) ?? []).slice(0, 2).map((camp) => (
                              <button
                                key={camp.campaignId}
                                type="button"
                                onClick={() => router.push(`/signs?sku=${encodeURIComponent(c.sku)}`)}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[10px] text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors"
                                title={`มีโปร ERP: ${camp.name}`}
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {camp.name.slice(0, 20)}{camp.name.length > 20 ? '…' : ''}
                              </button>
                            ))}
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
          <p className="text-xs">กำหนดจำนวนชิ้น + ราคารวม เช่น 3 ชิ้น ฿100 → ระบบดึงสินค้าที่ GP ผ่านเกณฑ์ (ใช้ GP ที่ดีกว่าระหว่างคำนวณ/ประวัติ){withAi ? ' + AI สรุป' : ''}</p>
        </div>
      )}

      {/* Product Detail Drawer */}
      <ProductDetailDrawer
        sku={detailSku}
        open={!!detailSku}
        onClose={() => setDetailSku(null)}
      />
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

// ──────────────────────────────────────────────────────────────────────────
// TAB: ERP Campaigns
// ──────────────────────────────────────────────────────────────────────────

function campaignStatusLabel(c: ErpCampaignCacheItem): 'active' | 'ending-soon' | 'expired' {
  if (!c.dateStop) return 'active';
  const stop = new Date(c.dateStop);
  const now = new Date();
  if (stop < now) return 'expired';
  return (stop.getTime() - now.getTime()) / 86400000 <= 7 ? 'ending-soon' : 'active';
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<ErpCampaignCacheItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCachedCampaigns(false);
      setCampaigns(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const doSync = async () => {
    setSyncing(true);
    try {
      const res = await syncErpCampaigns();
      alert(`Sync สำเร็จ: ${res.synced} campaigns`);
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Sync ไม่สำเร็จ');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = campaigns.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.code ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const statusBadge = (c: ErpCampaignCacheItem) => {
    const s = campaignStatusLabel(c);
    if (s === 'expired') return <Badge variant="secondary" className="text-xs">หมดแล้ว</Badge>;
    if (s === 'ending-soon') return <Badge className="bg-amber-500 text-white text-xs">ใกล้หมด</Badge>;
    return <Badge className="bg-emerald-600 text-white text-xs">กำลังใช้</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="h-9 w-64 rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            placeholder="ค้นชื่อ Campaign..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{campaigns.length} campaigns ใน cache</span>
          <Button size="sm" variant="outline" onClick={doSync} disabled={syncing}>
            {syncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Sync จาก ERP
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Gift className="h-8 w-8 opacity-30" />
          <p className="text-sm">{campaigns.length === 0 ? 'ยังไม่มีข้อมูล — กด Sync จาก ERP ก่อน' : 'ไม่พบ campaign ที่ค้น'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.campaignId} className="overflow-hidden">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpanded(expanded === c.campaignId ? null : c.campaignId)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Tag className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.code && <span className="mr-2 font-mono">{c.code}</span>}
                          {c.promotionTypeName || c.promotionType || '—'}
                          {c.dateStart && ` · ${c.dateStart}${c.dateStop ? ` – ${c.dateStop}` : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {statusBadge(c)}
                      <div className="text-right">
                        {Number(c.promoPrice) > 0 && (
                          <p className="text-sm font-bold text-primary">฿{Math.round(Number(c.promoPrice))}</p>
                        )}
                        {Number(c.discountPct) > 0 && (
                          <p className="text-xs text-muted-foreground">ลด {Number(c.discountPct).toFixed(0)}%</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">{c.productCount} สินค้า</Badge>
                    </div>
                  </div>
                </CardContent>
              </button>

              {/* Expanded product list */}
              {expanded === c.campaignId && (
                <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
                  {c.conditions && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">เงื่อนไข:</span> {c.conditions}
                    </p>
                  )}
                  {c.freeItems && c.freeItems.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ของแถม</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.freeItems.map((f) => (
                          <Badge key={`${f.sku}-${f.qty}`} variant="outline" className="text-xs font-normal">
                            {f.name || f.sku} ×{f.qty}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.products && c.products.length > 0 ? (
                  <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">สินค้าในแคมเปญ</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                          <TableHead className="text-right text-xs">ราคาปกติ</TableHead>
                          <TableHead className="text-right text-xs">ราคาโปร</TableHead>
                          <TableHead className="text-center text-xs">ขั้นต่ำ</TableHead>
                          <TableHead className="text-center text-xs">แถม</TableHead>
                          <TableHead className="text-right text-xs">GP%</TableHead>
                          <TableHead className="text-xs">Step</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {c.products.map((p) => (
                          <TableRow key={p.sku}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                            <TableCell className="text-xs max-w-[180px] truncate">{p.name}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {p.retailPrice > 0 ? `฿${p.retailPrice}` : '—'}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold text-primary">
                              {p.promoPrice > 0 ? `฿${Math.round(p.promoPrice)}` : '—'}
                            </TableCell>
                            <TableCell className="text-center text-xs">{p.minQty > 1 ? p.minQty : '—'}</TableCell>
                            <TableCell className="text-center text-xs">{p.freeItemQty > 0 ? p.freeItemQty : '—'}</TableCell>
                            <TableCell className="text-right text-xs">
                              {p.gp != null ? (
                                <span className={p.gp >= 30 ? 'text-emerald-600' : p.gp >= 20 ? 'text-amber-600' : 'text-red-500'}>
                                  {p.gp.toFixed(1)}%
                                </span>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{p.stepText}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">
                      ไม่มีข้อมูลสินค้าใน cache — Sync อีกครั้งเพื่อดึงรายการสินค้า
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// TAB: SKU Lookup
// ──────────────────────────────────────────────────────────────────────────

function SkuLookupTab() {
  const [sku, setSku] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookup, setLookup] = useState<SkuPromotionLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceSyncing, setForceSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const doLookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = sku.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setLookup(null);
    setSyncMsg(null);
    try {
      const data = await getSkuPromotionSteps(q);
      setLookup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ค้นหาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const doForceSync = async () => {
    const q = sku.trim();
    if (!q) return;
    setForceSyncing(true);
    setSyncMsg(null);
    try {
      const res = await forceSyncSkuPromotion(q);
      setSyncMsg(`Sync สำเร็จ: ${res.synced} โปรโมชัน — กำลังโหลดใหม่...`);
      await doLookup();
    } catch (err) {
      setSyncMsg(`Sync ล้มเหลว: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setForceSyncing(false);
    }
  };

  const results = lookup?.items ?? null;
  const sourceLabel = lookup?.source === 'live'
    ? 'ดึงจาก ERP สด'
    : lookup?.source === 'live+cache'
      ? 'ERP สด + cache'
      : lookup?.source === 'cache'
        ? 'จาก cache'
        : null;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">ค้นหาโปรโมชันตาม SKU</h2>
        <p className="text-sm text-muted-foreground">ใส่ SKU เพื่อดูว่าสินค้าตัวนี้อยู่ใน Campaign ไหนบ้าง พร้อมราคาโปรและ step</p>
      </div>

      <form onSubmit={(e) => { void doLookup(e); }} className="flex gap-2">
        <input
          className="flex-1 h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring font-mono uppercase"
          placeholder="เช่น RT20787 หรือ 1002565"
          value={sku}
          onChange={(e) => setSku(e.target.value.toUpperCase())}
        />
        <Button type="submit" disabled={loading || !sku.trim()}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
          ค้นหา
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={forceSyncing || !sku.trim()}
          onClick={() => void doForceSync()}
          title="บังคับ sync โปรโมชัน SKU นี้จาก ERP แล้วค้นหาใหม่"
        >
          {forceSyncing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          Force Sync
        </Button>
      </form>

      {syncMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{syncMsg}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {lookup !== null && (
        results && results.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border bg-muted/30 text-muted-foreground px-4 text-center">
            <Star className="h-6 w-6 opacity-30" />
            <p className="text-sm">
              {lookup.productId
                ? 'ERP ไม่พบแคมเปญที่ใช้งานสำหรับ SKU นี้ (active_only=1)'
                : 'ไม่พบสินค้า SKU นี้ใน ERP — ตรวจสอบรหัสสินค้า'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">พบ {results?.length ?? 0} โปรโมชัน</p>
              {sourceLabel && (
                <Badge variant="outline" className="text-xs font-normal">{sourceLabel}</Badge>
              )}
              {lookup.productId ? (
                <span className="text-xs text-muted-foreground">product_id: {lookup.productId}</span>
              ) : null}
            </div>
            {(results ?? []).map((step) => (
              <Card key={step.campaignId}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{step.campaignName}</p>
                        {step.campaignCode && (
                          <span className="font-mono text-xs text-muted-foreground">{step.campaignCode}</span>
                        )}
                        {step.dateStop && new Date(step.dateStop) < new Date() ? (
                          <Badge variant="secondary" className="text-xs">หมดแล้ว</Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white text-xs">ใช้งาน</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.promotionTypeName || step.promotionType || ''}
                        {step.dateStart && ` · ${step.dateStart}${step.dateStop ? ` – ${step.dateStop}` : ''}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {step.promoPrice > 0 ? (
                        <p className="text-xl font-bold text-primary">฿{Math.round(step.promoPrice)}</p>
                      ) : step.minAmount && step.minAmount > 0 ? (
                        <p className="text-lg font-bold text-primary">฿{Math.round(step.minAmount)}</p>
                      ) : null}
                      {step.retailPrice > 0 && (
                        <p className="text-xs text-muted-foreground line-through">฿{step.retailPrice}</p>
                      )}
                      {step.gp != null && (
                        <p className={`text-xs ${step.gp >= 30 ? 'text-emerald-600' : step.gp >= 20 ? 'text-amber-600' : 'text-red-500'}`}>
                          GP {step.gp.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <TrendingUp className="h-3 w-3" />
                    {step.stepText}
                    {step.minQty > 1 && <span className="text-muted-foreground">· ขั้นต่ำ {step.minQty} ชิ้น</span>}
                    {step.freeItemQty > 0 && <span className="text-muted-foreground">· แถม {step.freeItemQty}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
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
