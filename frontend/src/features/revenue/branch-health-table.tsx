'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { BranchHealthRow } from '@/lib/revenue-api';
import { baht, BranchStatusDot, GrowthChip } from './revenue-shared';
import type { CompareMode } from './revenue-constants';

type SortKey = 'revenue' | 'orders' | 'avgTicket';

interface BranchHealthTableProps {
  branches: BranchHealthRow[];
  compareMode: CompareMode;
  filter?: (b: BranchHealthRow) => boolean;
  defaultSort?: SortKey;
  emphasize?: 'revenue' | 'bills';
  limit?: number;
}

export function BranchHealthTable({
  branches,
  compareMode,
  filter,
  defaultSort = 'revenue',
  emphasize = 'revenue',
  limit,
}: BranchHealthTableProps) {
  const t = useTranslations('revenue');
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(() => {
    let list = filter ? branches.filter(filter) : [...branches];
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortAsc ? av - bv : bv - av;
    });
    if (limit) list = list.slice(0, limit);
    return list;
  }, [branches, filter, limit, sortAsc, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortLabel = (key: SortKey, label: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => toggleSort(key)}
    >
      {label}
      {sortKey === key && <span className="text-[10px]">{sortAsc ? '↑' : '↓'}</span>}
    </button>
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>{t('branch.name')}</TableHead>
            {emphasize !== 'bills' && (
              <TableHead className="text-right">{sortLabel('revenue', t('branch.revenue'))}</TableHead>
            )}
            {(compareMode === 'mom' || compareMode === 'both') && emphasize !== 'bills' && (
              <TableHead className="text-right text-xs">
                <span className="text-muted-foreground">MoM</span>
              </TableHead>
            )}
            {(compareMode === 'yoy' || compareMode === 'both') && emphasize !== 'bills' && (
              <TableHead className="text-right text-xs">
                <span className="text-amber-700">YoY</span>
              </TableHead>
            )}
            <TableHead className="text-right">{sortLabel('avgTicket', t('kpi.avgBill'))}</TableHead>
            <TableHead className="text-right">{sortLabel('orders', t('kpi.bills'))}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.id}>
              <TableCell>
                <BranchStatusDot status={b.status} />
              </TableCell>
              <TableCell>
                <div className="font-medium leading-tight">{b.name}</div>
                <div className="text-[11px] text-muted-foreground">{b.shortcode || b.code}</div>
              </TableCell>
              {emphasize !== 'bills' && (
                <TableCell className="text-right tabular-nums">{baht(b.revenue)}</TableCell>
              )}
              {(compareMode === 'mom' || compareMode === 'both') && emphasize !== 'bills' && (
                <TableCell className="text-right">
                  <div className="text-[11px] tabular-nums text-muted-foreground">{baht(b.prevRevenue)}</div>
                  <GrowthChip value={b.revenueGrowthPct} />
                </TableCell>
              )}
              {(compareMode === 'yoy' || compareMode === 'both') && emphasize !== 'bills' && (
                <TableCell className="text-right">
                  {b.yoyReliable ? (
                    <>
                      <div className="text-[11px] tabular-nums text-amber-700/80">{baht(b.yoyRevenue)}</div>
                      <GrowthChip value={b.yoyRevenueGrowthPct} />
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">ไม่มีข้อมูล</span>
                  )}
                </TableCell>
              )}
              <TableCell className={`text-right tabular-nums ${emphasize === 'bills' ? 'font-semibold' : ''}`}>
                {baht(b.avgTicket)}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums text-xs ${emphasize === 'bills' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                {b.orders.toLocaleString('th-TH')}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                ไม่มีสาขาในช่วงที่เลือก
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
