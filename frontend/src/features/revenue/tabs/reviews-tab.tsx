'use client';

import { ArrowRight, Loader2, Star } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-4">
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">{t('tabs.reviewsTotal')}</p><p className="mt-1 text-2xl font-bold">{stats?.totals.total ?? '—'}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">{t('tabs.reviewsAvg')}</p><p className="mt-1 text-2xl font-bold">{stats?.totals.avgRating ?? '—'}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">{t('tabs.reviewsNegative')}</p><p className="mt-1 text-2xl font-bold text-red-600">{stats?.totals.negative ?? '—'}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">{t('tabs.reviewsUnreplied')}</p><p className="mt-1 text-2xl font-bold text-amber-600">{stats?.totals.unreplied ?? '—'}</p></CardContent></Card>
        </div>
        <Link href="/reviews">
          <Button variant="outline" size="sm">
            {t('tabs.reviewsOpen')}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {stats && stats.totals.unassignedCount > 0 && (
        <p className="text-xs text-muted-foreground">{t('tabs.reviewsUnassigned', { count: stats.totals.unassignedCount })}</p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-muted-foreground" />
            {t('tabs.reviewsByBranch')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('tabs.reviewsLoading')}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && stats && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('branch.name')}</TableHead>
                    <TableHead className="text-right">{t('tabs.reviewsCount')}</TableHead>
                    <TableHead className="text-right">{t('tabs.reviewsAvg')}</TableHead>
                    <TableHead className="text-right">{t('tabs.reviewsNegative')}</TableHead>
                    <TableHead className="text-right">{t('tabs.reviewsUnreplied')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.branches.map((b) => (
                    <TableRow key={b.branchId}>
                      <TableCell>{b.branchId ? branchName(b.branchId) : t('tabs.reviewsUnassignedLabel')}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.total}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.avgRating.toFixed(1)}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
