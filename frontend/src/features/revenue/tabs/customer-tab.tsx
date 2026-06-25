'use client';

import { AlertCircle, BrainCircuit, Globe2, Link2, Loader2, Package, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CountryAnalyticsData } from '@/lib/revenue-api';
import { BranchCountryAnalyticsSection } from '../branch-country-analytics';
import { baht } from '../revenue-shared';
import { COUNTRY_RANGE_OPTIONS, type CountryRangePreset } from '../revenue-constants';

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
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Globe2 className="h-4 w-4 text-muted-foreground" />
            {t('branchCountry.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BranchCountryAnalyticsSection subtitle={t('branchCountry.subtitle')} failedMessage={t('branchCountry.failed')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">{t('tabs.customerBasket')}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t('tabs.customerBasketHint')}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { const next = countryInput || 'Thailand'; onCountryQuery(next); onRefresh(next); }} disabled={countryLoading}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${countryLoading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-9 w-[180px]" placeholder="Thailand" value={countryInput} onChange={(e) => onCountryInput(e.target.value)} onBlur={() => onCountryQuery(countryInput || 'Thailand')} />
            <div className="flex overflow-hidden rounded-lg border text-xs font-medium">
              {COUNTRY_RANGE_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => onCountryPreset(opt.id)} className={`px-3 py-1.5 transition-colors ${countryPreset === opt.id ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {countryPreset === 'custom' && (
              <div className="flex items-center gap-2">
                <Input type="date" className="h-9 w-[150px]" value={countryFrom} onChange={(e) => onCountryFrom(e.target.value)} />
                <span className="text-xs text-muted-foreground">ถึง</span>
                <Input type="date" className="h-9 w-[150px]" value={countryTo} onChange={(e) => onCountryTo(e.target.value)} />
              </div>
            )}
          </div>

          {countryError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{countryError}</div>}

          {countryData?.dataQuality.warnings.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('tabs.customerLoading')}
            </div>
          ) : countryData ? (
            <div className="grid gap-5 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-1">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{t('tabs.selectedCountry')}</p>
                  <p className="mt-1 text-lg font-bold">{countryData.selectedCountrySummary.country}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">{t('branch.revenue')}</p><p className="font-semibold">{baht(countryData.selectedCountrySummary.revenue)}</p></div>
                    <div><p className="text-xs text-muted-foreground">{t('kpi.bills')}</p><p className="font-semibold">{countryData.selectedCountrySummary.orders.toLocaleString('th-TH')}</p></div>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Globe2 className="h-4 w-4" />{t('tabs.topCountries')}</p>
                  <div className="space-y-2">
                    {countryData.countries.slice(0, 6).map((c, i) => (
                      <button key={c.country} type="button" className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted" onClick={() => { onCountryInput(c.country); onCountryQuery(c.country); onRefresh(c.country); }}>
                        <span className="w-5 text-right text-xs font-semibold text-muted-foreground">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.country}</span>
                        <span className="text-right text-xs text-muted-foreground">{baht(c.revenue)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-4 xl:col-span-2">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Package className="h-4 w-4" />{t('tabs.countryProducts')}</p>
                    <div className="space-y-2">
                      {countryData.topProducts.slice(0, 8).map((p) => (
                        <div key={p.sku} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                          <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{p.name}</div></div>
                          <div className="text-right text-sm font-semibold">{baht(p.revenue)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4" />{t('tabs.basketPairs')}</p>
                    <div className="space-y-2">
                      {countryData.basketPairs.slice(0, 6).map((p) => (
                        <div key={`${p.leftSku}-${p.rightSku}`} className="rounded-md border px-3 py-2 text-sm">
                          <div className="font-medium">{p.leftName} + {p.rightName}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{p.receiptCount} {t('kpi.bills')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <BrainCircuit className="h-4 w-4" />
                    AI Insight
                    <Badge variant="outline" className="ml-auto text-[10px]">{countryData.aiSummary.source}</Badge>
                  </p>
                  <div className="whitespace-pre-line text-sm text-muted-foreground">{countryData.aiSummary.text || '—'}</div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
