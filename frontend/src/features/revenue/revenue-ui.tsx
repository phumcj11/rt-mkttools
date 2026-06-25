'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Camera,
  Gift,
  Globe2,
  LayoutDashboard,
  Layers,
  Package,
  Receipt,
  Star,
  TrendingDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RevenueTabId } from './revenue-tabs';

export type TabTone =
  | 'violet'
  | 'blue'
  | 'cyan'
  | 'amber'
  | 'rose'
  | 'emerald'
  | 'orange'
  | 'indigo'
  | 'pink'
  | 'teal';

export const TONE_STYLES: Record<
  TabTone,
  {
    gradient: string;
    iconBg: string;
    iconText: string;
    tileBg: string;
    tileBorder: string;
    tileText: string;
    bar: string;
    tabActive: string;
    tabIdle: string;
  }
> = {
  violet: {
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    iconBg: 'bg-violet-500',
    iconText: 'text-violet-600',
    tileBg: 'bg-violet-50/80',
    tileBorder: 'border-violet-200',
    tileText: 'text-violet-700',
    bar: 'bg-violet-500',
    tabActive: 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200',
    tabIdle: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
  },
  blue: {
    gradient: 'from-blue-500 via-sky-500 to-cyan-500',
    iconBg: 'bg-blue-500',
    iconText: 'text-blue-600',
    tileBg: 'bg-blue-50/80',
    tileBorder: 'border-blue-200',
    tileText: 'text-blue-700',
    bar: 'bg-blue-500',
    tabActive: 'bg-gradient-to-r from-blue-500 to-sky-600 text-white shadow-md shadow-blue-200',
    tabIdle: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  },
  cyan: {
    gradient: 'from-cyan-500 via-teal-500 to-emerald-500',
    iconBg: 'bg-cyan-500',
    iconText: 'text-cyan-600',
    tileBg: 'bg-cyan-50/80',
    tileBorder: 'border-cyan-200',
    tileText: 'text-cyan-700',
    bar: 'bg-cyan-500',
    tabActive: 'bg-gradient-to-r from-cyan-500 to-teal-600 text-white shadow-md shadow-cyan-200',
    tabIdle: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
  },
  amber: {
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    iconBg: 'bg-amber-500',
    iconText: 'text-amber-600',
    tileBg: 'bg-amber-50/80',
    tileBorder: 'border-amber-200',
    tileText: 'text-amber-800',
    bar: 'bg-amber-500',
    tabActive: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200',
    tabIdle: 'bg-amber-50 text-amber-800 hover:bg-amber-100',
  },
  rose: {
    gradient: 'from-rose-500 via-red-500 to-orange-500',
    iconBg: 'bg-rose-500',
    iconText: 'text-rose-600',
    tileBg: 'bg-rose-50/80',
    tileBorder: 'border-rose-200',
    tileText: 'text-rose-700',
    bar: 'bg-rose-500',
    tabActive: 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-200',
    tabIdle: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  },
  emerald: {
    gradient: 'from-emerald-500 via-green-500 to-lime-500',
    iconBg: 'bg-emerald-500',
    iconText: 'text-emerald-600',
    tileBg: 'bg-emerald-50/80',
    tileBorder: 'border-emerald-200',
    tileText: 'text-emerald-700',
    bar: 'bg-emerald-500',
    tabActive: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-200',
    tabIdle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
  orange: {
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
    iconBg: 'bg-orange-500',
    iconText: 'text-orange-600',
    tileBg: 'bg-orange-50/80',
    tileBorder: 'border-orange-200',
    tileText: 'text-orange-700',
    bar: 'bg-orange-500',
    tabActive: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200',
    tabIdle: 'bg-orange-50 text-orange-700 hover:bg-orange-100',
  },
  indigo: {
    gradient: 'from-indigo-500 via-blue-600 to-violet-600',
    iconBg: 'bg-indigo-500',
    iconText: 'text-indigo-600',
    tileBg: 'bg-indigo-50/80',
    tileBorder: 'border-indigo-200',
    tileText: 'text-indigo-700',
    bar: 'bg-indigo-500',
    tabActive: 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-200',
    tabIdle: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
  },
  pink: {
    gradient: 'from-pink-500 via-rose-500 to-fuchsia-500',
    iconBg: 'bg-pink-500',
    iconText: 'text-pink-600',
    tileBg: 'bg-pink-50/80',
    tileBorder: 'border-pink-200',
    tileText: 'text-pink-700',
    bar: 'bg-pink-500',
    tabActive: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-200',
    tabIdle: 'bg-pink-50 text-pink-700 hover:bg-pink-100',
  },
  teal: {
    gradient: 'from-teal-500 via-cyan-500 to-sky-500',
    iconBg: 'bg-teal-500',
    iconText: 'text-teal-600',
    tileBg: 'bg-teal-50/80',
    tileBorder: 'border-teal-200',
    tileText: 'text-teal-700',
    bar: 'bg-teal-500',
    tabActive: 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-200',
    tabIdle: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
  },
};

export const TAB_THEME: Record<RevenueTabId, { tone: TabTone; icon: LucideIcon }> = {
  overview: { tone: 'violet', icon: LayoutDashboard },
  'branch-sales': { tone: 'blue', icon: Building2 },
  'bills-avg': { tone: 'cyan', icon: Receipt },
  campaign: { tone: 'amber', icon: Gift },
  declining: { tone: 'rose', icon: TrendingDown },
  products: { tone: 'emerald', icon: Package },
  categories: { tone: 'orange', icon: Layers },
  customer: { tone: 'indigo', icon: Globe2 },
  reviews: { tone: 'pink', icon: Star },
  field: { tone: 'teal', icon: Camera },
};

export const RANK_BAR_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-rose-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
];

export function IconBox({
  icon: Icon,
  tone,
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  tone: TabTone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const s = TONE_STYLES[tone];
  const dim = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const iconDim = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm', dim, s.iconBg, className)}>
      <Icon className={iconDim} />
    </span>
  );
}

export function TabHero({
  tabId,
  title,
  subtitle,
  extra,
}: {
  tabId: RevenueTabId;
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
}) {
  const { tone, icon: Icon } = TAB_THEME[tabId];
  const s = TONE_STYLES[tone];
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm sm:p-5', s.gradient)}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-8 right-12 h-20 w-20 rounded-full bg-white/5" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold leading-tight sm:text-xl">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-white/85">{subtitle}</p>}
          </div>
        </div>
        {extra}
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  valueClassName,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone: TabTone;
  valueClassName?: string;
}) {
  const s = TONE_STYLES[tone];
  return (
    <div className={cn('rounded-xl border p-4 transition-shadow hover:shadow-sm', s.tileBg, s.tileBorder)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums leading-tight', s.tileText, valueClassName)}>
            {value}
          </p>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <IconBox icon={Icon} tone={tone} size="sm" />
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  tone,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  tone: TabTone;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const s = TONE_STYLES[tone];
  return (
    <Card className={cn('overflow-hidden border shadow-sm', className)}>
      <CardHeader className={cn('border-b pb-3', s.tileBg)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconBox icon={Icon} tone={tone} size="sm" />
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

export function ChipToggleGroup<T extends string>({
  options,
  value,
  onChange,
  tone = 'blue',
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  tone?: TabTone;
}) {
  const s = TONE_STYLES[tone];
  return (
    <div className="inline-flex overflow-hidden rounded-xl border bg-background p-0.5 text-xs font-medium shadow-sm">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 transition-all',
            value === opt.id ? cn(s.tabActive, 'scale-[1.02]') : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-amber-950 shadow-sm">1</span>;
  if (rank === 2) return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-[11px] font-bold text-slate-800 shadow-sm">2</span>;
  if (rank === 3) return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-300 text-[11px] font-bold text-orange-950 shadow-sm">3</span>;
  return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{rank}</span>;
}

export function RevenueTabBar({
  tabs,
  activeTab,
  onSelect,
  labelFn,
  badgeFn,
}: {
  tabs: Array<{ id: RevenueTabId; labelKey: string }>;
  activeTab: RevenueTabId;
  onSelect: (id: RevenueTabId) => void;
  labelFn: (key: string) => string;
  badgeFn?: (id: RevenueTabId) => string | null;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-1 rounded-2xl border bg-background/95 px-2 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin snap-x snap-mandatory">
        {tabs.map((tab) => {
          const { tone, icon: Icon } = TAB_THEME[tab.id];
          const s = TONE_STYLES[tone];
          const active = activeTab === tab.id;
          const badge = badgeFn?.(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              className={cn(
                'flex shrink-0 snap-start items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all',
                active ? cn(s.tabActive, 'scale-[1.02]') : s.tabIdle,
              )}
            >
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', active ? 'bg-white/25' : 'bg-white/80 shadow-sm')}>
                <Icon className={cn('h-3.5 w-3.5', active ? 'text-white' : s.iconText)} />
              </span>
              <span className="whitespace-nowrap">{labelFn(tab.labelKey)}</span>
              {badge && (
                <Badge
                  variant={active ? 'secondary' : 'outline'}
                  className={cn('h-4 px-1.5 text-[10px]', active && 'bg-white/20 text-white border-white/30')}
                >
                  {badge}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
