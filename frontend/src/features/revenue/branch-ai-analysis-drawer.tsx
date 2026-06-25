'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Gift,
  Loader2,
  Package,
  RefreshCw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BranchAiAnalysisData, BranchHealthRow } from '@/lib/revenue-api';
import { getBranchAiAnalysis } from '@/lib/revenue-api';
import { baht, BranchStatusDot, GrowthChip } from './revenue-shared';
import { cn } from '@/lib/utils';

interface BranchAiAnalysisDrawerProps {
  branch: BranchHealthRow | null;
  open: boolean;
  onClose: () => void;
}

function BulletList({
  items,
  icon: Icon,
  tone,
}: {
  items: string[];
  icon: React.ElementType;
  tone: 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';
}) {
  const toneCls = {
    violet: 'border-violet-200 bg-violet-50/60 text-violet-900',
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-900',
    rose: 'border-rose-200 bg-rose-50/60 text-rose-900',
    cyan: 'border-cyan-200 bg-cyan-50/60 text-cyan-900',
  }[tone];

  if (items.length === 0) return null;

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={i}
          className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-sm', toneCls)}
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
          <span className="leading-snug">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function BranchAiAnalysisDrawer({ branch, open, onClose }: BranchAiAnalysisDrawerProps) {
  const t = useTranslations('revenue');
  const [data, setData] = useState<BranchAiAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!branch) return;
      setLoading(true);
      setError(null);
      try {
        const result = await getBranchAiAnalysis(branch.id, { force });
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('branchAi.failed'));
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [branch, t],
  );

  useEffect(() => {
    if (open && branch) {
      void load(false);
    } else if (!open) {
      setData(null);
      setError(null);
    }
  }, [open, branch, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !branch) return null;

  const maxTrend = Math.max(1, ...(data?.monthlyTrend.map((p) => p.revenue) ?? [1]));

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l bg-background shadow-2xl sm:max-w-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-ai-drawer-title"
      >
        <div className="flex items-start justify-between gap-3 border-b bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-4 text-white sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 shrink-0" />
              <h2 id="branch-ai-drawer-title" className="text-lg font-bold leading-tight">
                {t('branchAi.title')}
              </h2>
            </div>
            <p className="mt-1 truncate text-sm text-white/85">
              {branch.shortcode || branch.code} — {branch.name}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-white hover:bg-white/20"
            onClick={onClose}
            aria-label={t('branchAi.close')}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              <p className="text-sm">{t('branchAi.loading')}</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-medium">{error}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => void load(true)}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                {t('retry')}
              </Button>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <BranchStatusDot status={data.metrics.status} />
                <GrowthChip value={data.metrics.momRevenueGrowthPct} size="md" />
                {data.ai.source === 'openai' && (
                  <Badge variant="secondary" className="bg-violet-100 text-violet-800">
                    AI
                  </Badge>
                )}
                {data.ai.source === 'heuristic' && (
                  <Badge variant="outline">{t('branchAi.heuristic')}</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border bg-emerald-50/60 p-3">
                  <p className="text-xs text-muted-foreground">{t('kpi.mtd')}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800">
                    {baht(data.metrics.mtd.revenue)}
                  </p>
                </div>
                <div className="rounded-xl border bg-blue-50/60 p-3">
                  <p className="text-xs text-muted-foreground">{t('branchAi.threeMonth')}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-blue-800">
                    {baht(data.metrics.threeMonth.revenue)}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl border bg-cyan-50/60 p-3 sm:col-span-1">
                  <p className="text-xs text-muted-foreground">{t('kpi.avgBill')}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-cyan-800">
                    {baht(data.metrics.mtd.avgTicket)}
                  </p>
                </div>
              </div>

              {data.monthlyTrend.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold">{t('branchAi.monthlyTrend')}</p>
                  <div className="flex h-24 items-end gap-2 rounded-xl border bg-muted/30 p-3">
                    {data.monthlyTrend.map((p) => (
                      <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-violet-500/80 transition-all"
                          style={{ height: `${Math.max(8, (p.revenue / maxTrend) * 72)}px` }}
                          title={baht(p.revenue)}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {p.month.slice(5, 7)}/{p.month.slice(2, 4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.ai.summary && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4">
                  <p className="text-sm font-semibold text-violet-900">{t('branchAi.summary')}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-violet-950">{data.ai.summary}</p>
                </div>
              )}

              {data.ai.rootCauses.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    {t('branchAi.rootCauses')}
                  </h3>
                  <BulletList items={data.ai.rootCauses} icon={AlertTriangle} tone="amber" />
                </section>
              )}

              {data.ai.recommendedActions.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Target className="h-4 w-4 text-violet-600" />
                    {t('branchAi.actions')}
                  </h3>
                  <BulletList items={data.ai.recommendedActions} icon={Target} tone="violet" />
                </section>
              )}

              {data.ai.promotionIdeas.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Gift className="h-4 w-4 text-emerald-600" />
                    {t('branchAi.promotions')}
                  </h3>
                  <BulletList items={data.ai.promotionIdeas} icon={Gift} tone="emerald" />
                </section>
              )}

              {data.ai.stockClearIdeas.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Package className="h-4 w-4 text-cyan-600" />
                    {t('branchAi.clearance')}
                  </h3>
                  <BulletList items={data.ai.stockClearIdeas} icon={Package} tone="cyan" />
                </section>
              )}

              {data.ai.risks.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    {t('branchAi.risks')}
                  </h3>
                  <BulletList items={data.ai.risks} icon={AlertTriangle} tone="rose" />
                </section>
              )}

              {data.ai.next7DayChecklist.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {t('branchAi.checklist')}
                  </h3>
                  <BulletList items={data.ai.next7DayChecklist} icon={CheckCircle2} tone="emerald" />
                </section>
              )}

              {data.topProducts.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">{t('branchAi.topProducts')}</h3>
                  <div className="space-y-1.5">
                    {data.topProducts.slice(0, 5).map((p) => (
                      <div
                        key={p.sku}
                        className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium">{p.name}</span>
                        <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                          {baht(p.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t p-4 sm:px-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('branchAi.close')}
          </Button>
          <Button
            className="flex-1 bg-violet-600 hover:bg-violet-700"
            onClick={() => void load(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                {t('branchAi.refresh')}
              </>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}
