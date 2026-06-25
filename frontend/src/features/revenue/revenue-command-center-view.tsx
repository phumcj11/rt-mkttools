'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  BarChart2,
  Loader2,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import {
  getBranchDailySales,
  getCommandCenter,
  getCountryAnalytics,
  upsertCustomerMix,
  upsertSalesTargets,
  upsertTraffic,
  type BranchDailySalesData,
  type CommandCenterData,
  type CountryAnalyticsData,
} from '@/lib/revenue-api';
import { showError, showSuccess } from '@/lib/sweetalert';
import { COMPARE_OPTIONS, branchChartRange, countryRange, type BranchChartPreset, type CompareMode, type CountryRangePreset } from './revenue-constants';
import { REVENUE_TABS, parseRevenueTab, type RevenueTabId } from './revenue-tabs';
import { ChipToggleGroup, RevenueTabBar } from './revenue-ui';
import { OverviewTab } from './tabs/overview-tab';
import { BranchSalesTab } from './tabs/branch-sales-tab';
import { BillsAvgTab } from './tabs/bills-avg-tab';
import { CampaignTab } from './tabs/campaign-tab';
import { DecliningTab } from './tabs/declining-tab';
import { ProductsTab } from './tabs/products-tab';
import { CategoriesTab } from './tabs/categories-tab';
import { CustomerTab } from './tabs/customer-tab';
import { ReviewsTab } from './tabs/reviews-tab';
import { FieldTab } from './tabs/field-tab';

function tabBadge(data: CommandCenterData, tabId: RevenueTabId): string | null {
  if (tabId === 'campaign' && !data.billNearPromo.available) return 'ERP';
  if (tabId === 'categories' && data.categories.length === 0) return '—';
  if (tabId === 'field') return null;
  return null;
}

export function RevenueCommandCenterView() {
  const t = useTranslations('revenue');
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<RevenueTabId>(() => parseRevenueTab(searchParams.get('tab')));
  const [compareMode, setCompareMode] = useState<CompareMode>('mom');
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [trafficBranchId, setTrafficBranchId] = useState('');
  const [trafficDate, setTrafficDate] = useState('');
  const [trafficFoot, setTrafficFoot] = useState('');
  const [trafficTx, setTrafficTx] = useState('');
  const [mixBranchId, setMixBranchId] = useState('');
  const [mixDate, setMixDate] = useState('');
  const [mixType, setMixType] = useState('family');
  const [mixCount, setMixCount] = useState('');
  const [countryData, setCountryData] = useState<CountryAnalyticsData | null>(null);
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [countryInput, setCountryInput] = useState('Thailand');
  const [countryQuery, setCountryQuery] = useState('Thailand');
  const [countryPreset, setCountryPreset] = useState<CountryRangePreset>('mtd');
  const [countryFrom, setCountryFrom] = useState('');
  const [countryTo, setCountryTo] = useState('');
  const [branchChartData, setBranchChartData] = useState<BranchDailySalesData | null>(null);
  const [branchChartLoading, setBranchChartLoading] = useState(false);
  const [branchChartError, setBranchChartError] = useState<string | null>(null);
  const [branchChartPreset, setBranchChartPreset] = useState<BranchChartPreset>('last15');
  const [loadedTabs, setLoadedTabs] = useState<Set<RevenueTabId>>(() => new Set(['overview']));

  const yearMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const selectTab = useCallback((tab: RevenueTabId) => {
    setActiveTab(tab);
    setLoadedTabs((prev) => new Set(prev).add(tab));
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'overview') params.delete('tab');
    else params.set('tab', tab);
    const q = params.toString();
    router.replace(q ? `/revenue?${q}` : '/revenue', { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const tab = parseRevenueTab(searchParams.get('tab'));
    setActiveTab(tab);
    setLoadedTabs((prev) => new Set(prev).add(tab));
  }, [searchParams]);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCommandCenter({ force });
      setData(res);
      if (res.kpi.targetRevenue) setTargetInput(String(Math.round(res.kpi.targetRevenue)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('unavailable'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadCountryAnalytics = useCallback(async (force = false, countryOverride?: string) => {
    setCountryLoading(true);
    setCountryError(null);
    try {
      const range = countryRange(countryPreset, countryFrom, countryTo);
      const res = await getCountryAnalytics({
        ...range,
        country: countryOverride || countryQuery || 'Thailand',
        force,
      });
      setCountryData(res);
    } catch (err) {
      setCountryError(err instanceof ApiError ? err.message : t('tabs.customerLoading'));
    } finally {
      setCountryLoading(false);
    }
  }, [countryFrom, countryPreset, countryQuery, countryTo, t]);

  const loadBranchChart = useCallback(async (force = false) => {
    setBranchChartLoading(true);
    setBranchChartError(null);
    try {
      const range = branchChartRange(branchChartPreset);
      const res = await getBranchDailySales({ ...range, force });
      setBranchChartData(res);
    } catch (err) {
      setBranchChartError(err instanceof ApiError ? err.message : t('branchChart.failed'));
    } finally {
      setBranchChartLoading(false);
    }
  }, [branchChartPreset, t]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (loadedTabs.has('branch-sales')) void loadBranchChart();
  }, [loadedTabs, loadBranchChart, branchChartPreset]);

  useEffect(() => {
    if (loadedTabs.has('customer')) void loadCountryAnalytics();
  }, [loadedTabs, loadCountryAnalytics]);

  const handleSaveTarget = async () => {
    const amount = parseFloat(targetInput.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) { showError(t('target.invalid')); return; }
    setSavingTarget(true);
    try {
      await upsertSalesTargets([{ yearMonth, branchId: null, targetRevenue: amount }]);
      showSuccess(t('target.saved'));
      await load(true);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('target.failed'));
    } finally { setSavingTarget(false); }
  };

  const handleSaveTraffic = async () => {
    const branchId = parseInt(trafficBranchId, 10);
    const footTraffic = parseInt(trafficFoot, 10);
    if (!trafficDate || !Number.isFinite(branchId) || !Number.isFinite(footTraffic)) {
      showError(t('setup.invalid')); return;
    }
    try {
      await upsertTraffic([{ branchId, trafficDate, footTraffic, transactions: trafficTx ? parseInt(trafficTx, 10) : null }]);
      showSuccess(t('setup.trafficSaved'));
      await load(true);
    } catch (err) { showError(err instanceof ApiError ? err.message : t('setup.failed')); }
  };

  const handleSaveMix = async () => {
    const branchId = parseInt(mixBranchId, 10);
    const count = parseInt(mixCount, 10);
    if (!mixDate || !Number.isFinite(branchId) || !Number.isFinite(count)) {
      showError(t('setup.invalid')); return;
    }
    try {
      await upsertCustomerMix([{ branchId, mixDate, customerType: mixType, count }]);
      showSuccess(t('setup.mixSaved'));
      await load(true);
    } catch (err) { showError(err instanceof ApiError ? err.message : t('setup.failed')); }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm">{t('tabs.loading')}</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-10 w-10 text-destructive/60" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => void load(true)}>
          <RefreshCw className="mr-2 h-4 w-4" /> {t('retry')}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const branchOptions = data.activeBranches.length > 0
    ? data.activeBranches
    : data.branchHealth.branches.map((b) => ({ id: b.id, code: b.code, shortcode: b.shortcode, name: b.name }));

  const decliningCount = data.branchHealth.red + data.branchHealth.yellow;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 p-4 text-white shadow-md sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <BarChart2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold leading-tight sm:text-2xl">{t('title')}</h1>
              <p className="mt-0.5 text-sm text-white/75">
                MTD {data.period.mtdFrom} → {data.period.mtdTo}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ChipToggleGroup
              options={COMPARE_OPTIONS}
              value={compareMode}
              onChange={setCompareMode}
              tone="violet"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-white/70" />}
            <Button
              variant="secondary"
              size="sm"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={() => { void load(true); if (loadedTabs.has('branch-sales')) void loadBranchChart(true); if (loadedTabs.has('customer')) void loadCountryAnalytics(true); }}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">{t('refresh')}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className={showSetup ? 'bg-white text-slate-900 hover:bg-white/90' : 'border-white/20 bg-white/10 text-white hover:bg-white/20'}
              onClick={() => setShowSetup((v) => !v)}
            >
              <Settings2 className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">{t('setup.title')}</span>
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: t('branch.green'), value: data.branchHealth.green, cls: 'bg-emerald-500/20 text-emerald-100' },
            { label: t('branch.yellow'), value: data.branchHealth.yellow, cls: 'bg-amber-500/20 text-amber-100' },
            { label: t('branch.red'), value: data.branchHealth.red, cls: 'bg-rose-500/20 text-rose-100' },
            { label: t('kpi.mtd'), value: `฿${Math.round(data.kpi.mtd.revenue).toLocaleString('th-TH')}`, cls: 'bg-violet-500/20 text-violet-100' },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl px-3 py-2 ${item.cls}`}>
              <p className="text-xs font-medium opacity-80">{item.label}</p>
              <p className="mt-0.5 text-base font-bold tabular-nums sm:text-lg">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <RevenueTabBar
        tabs={REVENUE_TABS}
        activeTab={activeTab}
        onSelect={selectTab}
        labelFn={(key) => t(key)}
        badgeFn={(tabId) =>
          tabId === 'declining' && decliningCount > 0 ? String(decliningCount)
          : tabId === 'campaign' && !data.billNearPromo.available ? 'ERP'
          : tabBadge(data, tabId)
        }
      />

      {activeTab === 'overview' && (
        <OverviewTab
          data={data}
          compareMode={compareMode}
          showSetup={showSetup}
          targetInput={targetInput}
          savingTarget={savingTarget}
          trafficBranchId={trafficBranchId}
          trafficDate={trafficDate}
          trafficFoot={trafficFoot}
          trafficTx={trafficTx}
          mixBranchId={mixBranchId}
          mixDate={mixDate}
          mixType={mixType}
          mixCount={mixCount}
          branchOptions={branchOptions}
          onTargetInput={setTargetInput}
          onSaveTarget={() => void handleSaveTarget()}
          onTrafficBranchId={setTrafficBranchId}
          onTrafficDate={setTrafficDate}
          onTrafficFoot={setTrafficFoot}
          onTrafficTx={setTrafficTx}
          onMixBranchId={setMixBranchId}
          onMixDate={setMixDate}
          onMixType={setMixType}
          onMixCount={setMixCount}
          onSaveTraffic={() => void handleSaveTraffic()}
          onSaveMix={() => void handleSaveMix()}
        />
      )}

      {activeTab === 'branch-sales' && loadedTabs.has('branch-sales') && (
        <BranchSalesTab
          data={data}
          compareMode={compareMode}
          branchChartData={branchChartData}
          branchChartLoading={branchChartLoading}
          branchChartError={branchChartError}
          branchChartPreset={branchChartPreset}
          onBranchChartPreset={setBranchChartPreset}
        />
      )}

      {activeTab === 'bills-avg' && <BillsAvgTab data={data} compareMode={compareMode} />}
      {activeTab === 'campaign' && <CampaignTab data={data} />}
      {activeTab === 'declining' && <DecliningTab data={data} compareMode={compareMode} />}
      {activeTab === 'products' && <ProductsTab data={data} />}
      {activeTab === 'categories' && <CategoriesTab data={data} />}

      {activeTab === 'customer' && loadedTabs.has('customer') && (
        <CustomerTab
          countryData={countryData}
          countryLoading={countryLoading}
          countryError={countryError}
          countryInput={countryInput}
          countryPreset={countryPreset}
          countryFrom={countryFrom}
          countryTo={countryTo}
          onCountryInput={setCountryInput}
          onCountryQuery={setCountryQuery}
          onCountryPreset={setCountryPreset}
          onCountryFrom={setCountryFrom}
          onCountryTo={setCountryTo}
          onRefresh={(c) => void loadCountryAnalytics(true, c)}
        />
      )}

      {activeTab === 'reviews' && loadedTabs.has('reviews') && <ReviewsTab data={data} />}
      {activeTab === 'field' && loadedTabs.has('field') && <FieldTab data={data} />}
    </div>
  );
}
