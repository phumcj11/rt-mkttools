'use client';

import { AlertCircle, AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { BranchHealthRow } from '@/lib/revenue-api';
import { cn } from '@/lib/utils';
import { TONE_STYLES, type TabTone } from './revenue-ui';

export function baht(value: number): string {
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

export function pctText(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function GrowthChip({ value, size = 'sm' }: { value: number | null; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'text-sm font-semibold' : 'text-xs font-medium';
  if (value === null) return <span className={`${cls} text-muted-foreground`}>ไม่มีข้อมูล</span>;
  if (value > 0)
    return (
      <span className={`inline-flex items-center gap-0.5 ${cls} text-emerald-600`}>
        <TrendingUp className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
        {pctText(value)}
      </span>
    );
  if (value < 0)
    return (
      <span className={`inline-flex items-center gap-0.5 ${cls} text-red-600`}>
        <TrendingDown className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
        {pctText(value)}
      </span>
    );
  return <span className={`${cls} text-muted-foreground`}>—</span>;
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
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        โต
      </span>
    );
  if (status === 'yellow')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        ทรงตัว
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      ยอดตก
    </span>
  );
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
  tone,
  alert,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ElementType;
  accent?: string;
  tone?: TabTone;
  alert?: boolean;
}) {
  const s = tone ? TONE_STYLES[tone] : null;
  return (
    <Card className={cn('overflow-hidden transition-shadow hover:shadow-md', alert ? 'border-red-200 bg-red-50/30' : s?.tileBorder, s && s.tileBg)}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className={cn('mt-1 text-2xl font-bold leading-tight tabular-nums sm:text-3xl', s?.tileText)}>{value}</p>
            {sub && <div className="mt-0.5">{sub}</div>}
          </div>
          <span className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm',
            s ? cn(s.iconBg, 'text-white') : cn('bg-muted', accent),
          )}>
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
