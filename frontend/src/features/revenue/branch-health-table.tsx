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

function CompareCell({
  prevValue,
  pct,
  formatFn = baht,
  reliable = true,
  emphasize = false,
}: {
  prevValue: number;
  pct: number | null;
  formatFn?: (v: number) => string;
  reliable?: boolean;
  emphasize?: boolean;
}) {
  if (!reliable) {
    return <span className="text-sm text-muted-foreground">ไม่มีข้อมูล</span>;
  }
  return (
    <div className={emphasize ? 'space-y-0.5' : ''}>
      <div className={`tabular-nums text-muted-foreground ${emphasize ? 'text-sm' : 'text-xs'}`}>
        {formatFn(prevValue)}
      </div>
      <GrowthChip value={pct} size={emphasize ? 'md' : 'sm'} />
    </div>
  );
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

  const showMom = compareMode === 'mom' || compareMode === 'both';
  const showYoy = compareMode === 'yoy' || compareMode === 'both';
  const billsMode = emphasize === 'bills';

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
      className="inline-flex items-center gap-1 text-sm font-semibold hover:text-foreground"
      onClick={() => toggleSort(key)}
    >
      {label}
      {sortKey === key && <span className="text-xs">{sortAsc ? '↑' : '↓'}</span>}
    </button>
  );

  const numCls = billsMode ? 'text-base font-bold tabular-nums sm:text-lg' : 'text-right tabular-nums';

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24" />
            <TableHead className="min-w-[140px]">{t('branch.name')}</TableHead>
            {!billsMode && (
              <TableHead className="text-right">{sortLabel('revenue', t('branch.revenue'))}</TableHead>
            )}
            {!billsMode && showMom && (
              <TableHead className="text-right text-sm">
                <span className="text-blue-600">MoM ยอด</span>
              </TableHead>
            )}
            {!billsMode && showYoy && (
              <TableHead className="text-right text-sm">
                <span className="text-amber-700">YoY ยอด</span>
              </TableHead>
            )}
            <TableHead className="text-right">{sortLabel('avgTicket', t('kpi.avgBill'))}</TableHead>
            {billsMode && showMom && (
              <TableHead className="text-right text-sm">
                <span className="text-blue-600">MoM avg</span>
              </TableHead>
            )}
            {billsMode && showYoy && (
              <TableHead className="text-right text-sm">
                <span className="text-amber-700">YoY avg</span>
              </TableHead>
            )}
            <TableHead className="text-right">{sortLabel('orders', t('kpi.bills'))}</TableHead>
            {billsMode && showMom && (
              <TableHead className="text-right text-sm">
                <span className="text-blue-600">MoM บิล</span>
              </TableHead>
            )}
            {billsMode && showYoy && (
              <TableHead className="text-right text-sm">
                <span className="text-amber-700">YoY บิล</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.id} className="transition-colors hover:bg-muted/40">
              <TableCell>
                <BranchStatusDot status={b.status} />
              </TableCell>
              <TableCell>
                <div className="text-sm font-semibold leading-tight sm:text-base">{b.name}</div>
                <div className="text-xs text-muted-foreground">{b.shortcode || b.code}</div>
              </TableCell>
              {!billsMode && (
                <TableCell className={`text-right ${numCls}`}>{baht(b.revenue)}</TableCell>
              )}
              {!billsMode && showMom && (
                <TableCell className="text-right">
                  <CompareCell prevValue={b.prevRevenue} pct={b.revenueGrowthPct} emphasize={billsMode} />
                </TableCell>
              )}
              {!billsMode && showYoy && (
                <TableCell className="text-right">
                  <CompareCell
                    prevValue={b.yoyRevenue}
                    pct={b.yoyRevenueGrowthPct}
                    reliable={b.yoyReliable}
                    emphasize={billsMode}
                  />
                </TableCell>
              )}
              <TableCell className={`text-right ${numCls} ${billsMode ? 'text-cyan-700' : ''}`}>
                {baht(b.avgTicket)}
              </TableCell>
              {billsMode && showMom && (
                <TableCell className="text-right">
                  <CompareCell prevValue={b.prevAvgTicket} pct={b.avgTicketGrowthPct} emphasize />
                </TableCell>
              )}
              {billsMode && showYoy && (
                <TableCell className="text-right">
                  <CompareCell
                    prevValue={b.yoyAvgTicket}
                    pct={b.yoyAvgTicketGrowthPct}
                    reliable={b.yoyReliable}
                    emphasize
                  />
                </TableCell>
              )}
              <TableCell className={`text-right ${numCls} ${billsMode ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                {b.orders.toLocaleString('th-TH')}
              </TableCell>
              {billsMode && showMom && (
                <TableCell className="text-right">
                  <CompareCell
                    prevValue={b.prevOrders}
                    pct={b.ordersGrowthPct}
                    formatFn={(v) => v.toLocaleString('th-TH')}
                    emphasize
                  />
                </TableCell>
              )}
              {billsMode && showYoy && (
                <TableCell className="text-right">
                  <CompareCell
                    prevValue={b.yoyOrders}
                    pct={b.yoyOrdersGrowthPct}
                    formatFn={(v) => v.toLocaleString('th-TH')}
                    reliable={b.yoyReliable}
                    emphasize
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={12} className="py-8 text-center text-sm text-muted-foreground">
                ไม่มีสาขาในช่วงที่เลือก
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
