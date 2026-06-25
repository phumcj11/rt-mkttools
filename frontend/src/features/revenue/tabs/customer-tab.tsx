'use client';

import { AlertCircle, BrainCircuit, Globe2, Link2, Loader2, MapPin, Package, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CountryAnalyticsData } from '@/lib/revenue-api';
import { BranchCountryAnalyticsSection } from '../branch-country-analytics';
import { baht } from '../revenue-shared';
import { COUNTRY_RANGE_OPTIONS, type CountryRangePreset } from '../revenue-constants';
import { ChipToggleGroup, RankBadge, SectionCard, TabHero } from '../revenue-ui';

interface CustomerTabProps {
  countryData: CountryAnalyticsData | null;
  countryLoading: boolean;
  countryError: string | null;
  countryInput: string;
  countryPreset: CountryRangePreset;
  countryFrom: string;
  countryTo: string;
  onCountryInput: (v: string) => void;
  onCountryQuery: (v: string) => void;
  onCountryPreset: (v: CountryRangePreset) => void;
  onCountryFrom: (v: string) => void;
  onCountryTo: (v: string) => void;
  onRefresh: (countryOverride?: string) => void;
}

export function CustomerTab({
  countryData,
  countryLoading,
  countryError,
  countryInput,
  countryPreset,
  countryFrom,
  countryTo,
  onCountryInput,
  onCountryQuery,
  onCountryPreset,
  onCountryFrom,
  onCountryTo,
  onRefresh,
}: CustomerTabProps) {
  const t = useTranslations('revenue');

  return (
    <div className="space-y-5">
      <TabHero tabId="customer" title={t('tabs.customer')} subtitle={t('tabHero.customer')} />

      <SectionCard tone="indigo" icon={MapPin} title={t('branchCountry.title')} subtitle={t('branchCountry.subtitle')}>
        <BranchCountryAnalyticsSection subtitle={t('branchCountry.subtitle')} failedMessage={t('branchCountry.failed')} />
      </SectionCard>

      <SectionCard
        tone="violet"
        icon={Globe2}
        title={t('tabs.customerBasket')}
        subtitle={t('tabs.customerBasketHint')}
        action={
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => { const next = countryInput || 'Thailand'; onCountryQuery(next); onRefresh(next); }}
            disabled={countryLoading}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${countryLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-10 w-[180px] border-indigo-200 focus-visible:ring-indigo-400"
              placeholder="Thailand"
              value={countryInput}
              onChange={(e) => onCountryInput(e.target.value)}
              onBlur={() => onCountryQuery(countryInput || 'Thailand')}
            />
            <ChipToggleGroup options={COUNTRY_RANGE_OPTIONS} value={countryPreset} onChange={onCountryPreset} tone="indigo" />
            {countryPreset === 'custom' && (
              <div className="flex items-center gap-2">
                <Input type="date" className="h-10 w-[150px]" value={countryFrom} onChange={(e) => onCountryFrom(e.target.value)} />
                <span className="text-xs text-muted-foreground">ถึง</span>
                <Input type="date" className="h-10 w-[150px]" value={countryTo} onChange={(e) => onCountryTo(e.target.value)} />
              </div>
            )}
          </div>

          {countryError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{countryError}</div>
          )}

          {countryData?.dataQuality.warnings.length ? (
            <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div className="space-y-1">
                  {countryData.dataQuality.warnings.slice(0, 3).map((w) => <p key={w}>{w}</p>)}
                </div>
              </div>
            </div>
          ) : null}

          {countryLoading && !countryData ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-500" />
              {t('tabs.customerLoading')}
            </div>
          ) : countryData ? (
            <div className="grid gap-5 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-1">
                <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
                  <p className="text-xs font-medium text-indigo-600">{t('tabs.selectedCountry')}</p>
                  <p className="mt-1 flex items-center gap-2 text-lg font-bold text-indigo-900">
                    <Globe2 className="h-5 w-5 text-indigo-500" />
                    {countryData.selectedCountrySummary.country}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-white/70 p-2">
                      <p className="text-xs text-muted-foreground">{t('branch.revenue')}</p>
                      <p className="font-bold text-indigo-700">{baht(countryData.selectedCountrySummary.revenue)}</p>
                    </div>
                    <div className="rounded-lg bg-white/70 p-2">
                      <p className="text-xs text-muted-foreground">{t('kpi.bills')}</p>
                      <p className="font-bold">{countryData.selectedCountrySummary.orders.toLocaleString('th-TH')}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Globe2 className="h-4 w-4 text-indigo-500" />
                    {t('tabs.topCountries')}
                  </p>
                  <div className="space-y-1.5">
                    {countryData.countries.slice(0, 6).map((c, i) => (
                      <button
                        key={c.country}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-indigo-50"
                        onClick={() => { onCountryInput(c.country); onCountryQuery(c.country); onRefresh(c.country); }}
                      >
                        <RankBadge rank={i + 1} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.country}</span>
                        <span className="text-right text-xs font-semibold text-indigo-700">{baht(c.revenue)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-4 xl:col-span-2">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <Package className="h-4 w-4" />
                      {t('tabs.countryProducts')}
                    </p>
                    <div className="space-y-1.5">
                      {countryData.topProducts.slice(0, 8).map((p, i) => (
                        <div key={p.sku} className="flex items-center gap-2 rounded-lg bg-white/60 px-2 py-1.5">
                          <RankBadge rank={i + 1} />
                          <div className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</div>
                          <div className="text-sm font-bold text-emerald-700">{baht(p.revenue)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-800">
                      <Link2 className="h-4 w-4" />
                      {t('tabs.basketPairs')}
                    </p>
                    <div className="space-y-2">
                      {countryData.basketPairs.slice(0, 6).map((p) => (
                        <div key={`${p.leftSku}-${p.rightSku}`} className="rounded-lg border border-violet-100 bg-white/70 px-3 py-2 text-sm">
                          <div className="font-medium leading-snug">{p.leftName} + {p.rightName}</div>
                          <div className="mt-1 text-[11px] text-violet-600">{p.receiptCount} {t('kpi.bills')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/50 p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <BrainCircuit className="h-4 w-4 text-indigo-600" />
                    AI Insight
                    <Badge variant="outline" className="ml-auto border-indigo-200 text-[10px] text-indigo-700">{countryData.aiSummary.source}</Badge>
                  </p>
                  <div className="whitespace-pre-line text-sm text-muted-foreground">{countryData.aiSummary.text || '—'}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
