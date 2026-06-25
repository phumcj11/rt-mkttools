'use client';

import { ArrowRight, Loader2, MessageSquare, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api';
import type { CommandCenterData } from '@/lib/revenue-api';
import { getReviewStatsByBranch, type ReviewStatsByBranchData } from '@/lib/reviews-api';
import { SectionCard, StatTile, TabHero } from '../revenue-ui';

interface ReviewsTabProps {
  data: CommandCenterData;
}

export function ReviewsTab({ data }: ReviewsTabProps) {
  const t = useTranslations('revenue');
  const [stats, setStats] = useState<ReviewStatsByBranchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getReviewStatsByBranch({
        from: data.period.mtdFrom,
        to: data.period.mtdTo,
      });
      setStats(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('tabs.reviewsFailed'));
    } finally {
      setLoading(false);
    }
  }, [data.period.mtdFrom, data.period.mtdTo, t]);

  useEffect(() => { void load(); }, [load]);

  const branchName = (branchId: number) => {
    const b = data.branchHealth.branches.find((x) => x.id === branchId);
    return b ? `${b.shortcode || b.code} — ${b.name}` : `#${branchId}`;
  };

  return (
    <div className="space-y-5">
      <TabHero
        tabId="reviews"
        title={t('tabs.reviews')}
        subtitle={t('tabHero.reviews')}
        extra={
          <Link href="/reviews">
            <Button size="sm" className="border-white/30 bg-white/20 text-white hover:bg-white/30">
              {t('tabs.reviewsOpen')}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile tone="pink" icon={Star} label={t('tabs.reviewsTotal')} value={stats?.totals.total ?? '—'} />
        <StatTile tone="amber" icon={ThumbsUp} label={t('tabs.reviewsAvg')} value={stats?.totals.avgRating ?? '—'} />
        <StatTile tone="rose" icon={ThumbsDown} label={t('tabs.reviewsNegative')} value={stats?.totals.negative ?? '—'} valueClassName="text-red-600" />
        <StatTile tone="orange" icon={MessageSquare} label={t('tabs.reviewsUnreplied')} value={stats?.totals.unreplied ?? '—'} valueClassName="text-amber-700" />
      </div>

      {stats && stats.totals.unassignedCount > 0 && (
        <p className="rounded-xl border border-pink-200 bg-pink-50/60 px-3 py-2 text-xs text-pink-800">
          {t('tabs.reviewsUnassigned', { count: stats.totals.unassignedCount })}
        </p>
      )}

      <SectionCard tone="pink" icon={Star} title={t('tabs.reviewsByBranch')} subtitle={t('tabHero.reviewsTable')}>
        {loading && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-pink-500" />
            {t('tabs.reviewsLoading')}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && stats && (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-pink-50/60">
                  <TableHead>{t('branch.name')}</TableHead>
                  <TableHead className="text-right">{t('tabs.reviewsCount')}</TableHead>
                  <TableHead className="text-right">{t('tabs.reviewsAvg')}</TableHead>
                  <TableHead className="text-right">{t('tabs.reviewsNegative')}</TableHead>
                  <TableHead className="text-right">{t('tabs.reviewsUnreplied')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.branches.map((b) => (
                  <TableRow key={b.branchId} className="hover:bg-pink-50/30">
                    <TableCell className="font-medium">{b.branchId ? branchName(b.branchId) : t('tabs.reviewsUnassignedLabel')}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.total}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {b.avgRating.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-600">{b.negative}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">{b.unreplied}</TableCell>
                  </TableRow>
                ))}
                {stats.branches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t('tabs.reviewsEmpty')}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
