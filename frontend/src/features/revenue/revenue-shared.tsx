'use client';

import { AlertCircle, AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { BranchHealthRow } from '@/lib/revenue-api';

export function baht(value: number): string {
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

export function pctText(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function GrowthChip({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">ไม่มีข้อมูล</span>;
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600">
        <TrendingUp className="h-3 w-3" />
        {pctText(value)}
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600">
        <TrendingDown className="h-3 w-3" />
        {pctText(value)}
      </span>
    );
  return <span className="text-xs text-muted-foreground">—</span>;
}

export function CompareRow({
  label,
  prevValue,
  pct,
  formatFn = baht,
  labelClass = 'text-muted-foreground',
  unavailable = false,
}: {
  label: string;
  prevValue: number;
  pct: number | null;
  formatFn?: (v: number) => string;
  labelClass?: string;
  unavailable?: boolean;
}) {
  if (unavailable || (prevValue <= 0 && pct === null)) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={labelClass}>{label}</span>
        <span>ไม่มีข้อมูล</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className={labelClass}>{label}</span>
      <span className="text-muted-foreground">{formatFn(prevValue)}</span>
      <GrowthChip value={pct} />
    </div>
  );
}

export function BranchStatusDot({ status }: { status: BranchHealthRow['status'] }) {
  if (status === 'green')
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" title="โต" />;
  if (status === 'yellow')
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" title="ทรงตัว" />;
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" title="ยอดตก" />;
}

export function DiagnosisIcon({ severity }: { severity: string }) {
  if (severity === 'high') return <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />;
  if (severity === 'medium') return <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />;
  return <Info className="h-4 w-4 shrink-0 text-slate-500" />;
}

export function severityClass(severity: string) {
  if (severity === 'high') return 'border-red-200 bg-red-50/60 text-red-900';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50/60 text-amber-900';
  return 'border-slate-200 bg-slate-50/60 text-slate-700';
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'text-primary',
  alert,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ElementType;
  accent?: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-red-200' : ''}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold leading-tight">{value}</p>
            {sub && <div className="mt-0.5">{sub}</div>}
          </div>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ${accent}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function localDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
