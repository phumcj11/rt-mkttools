'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { BranchDailySalesData } from '@/lib/revenue-api';

const COLORS = [
  '#e11d48', '#f97316', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
  '#78716c', '#0ea5e9', '#10b981',
];

const TH_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function baht(value: number): string {
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

function fmtThaiDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  return `${d} ${TH_MONTHS[m - 1] ?? parts[1]}`;
}

function niceMax(value: number): number {
  if (value <= 0) return 100_000;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function buildPath(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}

interface Props {
  data: BranchDailySalesData | null;
  loading?: boolean;
}

export function BranchDailySalesChart({ data, loading }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());

  const chart = useMemo(() => {
    if (!data || data.dates.length === 0) return null;

    const visibleBranches = data.branches.filter((b) => !hidden.has(b.id));
    let maxRev = 0;
    for (const b of visibleBranches) {
      for (const p of b.points) {
        if (p.revenue > maxRev) maxRev = p.revenue;
      }
    }
    const yMax = niceMax(maxRev);

    const W = 800;
    const H = 280;
    const padL = 56;
    const padR = 12;
    const padT = 12;
    const padB = 28;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const n = data.dates.length;

    const xAt = (i: number) => (n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW);
    const yAt = (v: number) => padT + innerH - (v / yMax) * innerH;

    const lines = data.branches.map((b, bi) => ({
      branch: b,
      color: COLORS[bi % COLORS.length],
      path: buildPath(
        b.points.map((p, i) => ({ x: xAt(i), y: yAt(p.revenue) })),
      ),
      visible: !hidden.has(b.id),
    }));

    const yTicks = [0, yMax / 2, yMax];
    const xLabelIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

    return { W, H, padL, padR, padT, padB, innerW, innerH, yMax, xAt, yAt, lines, yTicks, xLabelIdx, n };
  }, [data, hidden]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!chart || !data || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * chart.W;
      const ratio = (relX - chart.padL) / chart.innerW;
      const idx = Math.round(ratio * (chart.n - 1));
      setHoverIdx(Math.max(0, Math.min(chart.n - 1, idx)));
    },
    [chart, data],
  );

  const toggleBranch = (id: number) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">กำลังโหลดกราฟสาขา…</span>
      </div>
    );
  }

  if (!data || !chart || data.dates.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูลยอดขายรายวันในช่วงที่เลือก</p>
    );
  }

  const hoverDate = hoverIdx !== null ? data.dates[hoverIdx] : null;
  const tooltipRows = hoverDate
    ? data.branches
        .map((b, bi) => ({
          id: b.id,
          shortcode: b.shortcode,
          revenue: b.points[hoverIdx!]?.revenue ?? 0,
          color: COLORS[bi % COLORS.length],
          hidden: hidden.has(b.id),
        }))
        .filter((r) => !r.hidden && r.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
    : [];

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chart.W} ${chart.H}`}
          className="w-full touch-none select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* grid + Y labels */}
          {chart.yTicks.map((tick) => {
            const y = chart.yAt(tick);
            return (
              <g key={tick}>
                <line
                  x1={chart.padL}
                  y1={y}
                  x2={chart.W - chart.padR}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <text
                  x={chart.padL - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {tick >= 1_000_000
                    ? `${(tick / 1_000_000).toFixed(tick >= 10_000_000 ? 0 : 1)}M`
                    : tick >= 1_000
                      ? `${Math.round(tick / 1_000)}K`
                      : tick}
                </text>
              </g>
            );
          })}

          {/* lines */}
          {chart.lines.map(({ branch, color, path, visible }) =>
            visible ? (
              <path
                key={branch.id}
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={hoverIdx !== null ? 1.5 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={hoverIdx !== null ? 0.85 : 1}
              />
            ) : null,
          )}

          {/* hover crosshair */}
          {hoverIdx !== null && (
            <>
              <line
                x1={chart.xAt(hoverIdx)}
                y1={chart.padT}
                x2={chart.xAt(hoverIdx)}
                y2={chart.H - chart.padB}
                stroke="currentColor"
                strokeOpacity={0.25}
                strokeDasharray="4 3"
              />
              {chart.lines.map(({ branch, color, visible }) => {
                if (!visible) return null;
                const rev = branch.points[hoverIdx]?.revenue ?? 0;
                return (
                  <circle
                    key={branch.id}
                    cx={chart.xAt(hoverIdx)}
                    cy={chart.yAt(rev)}
                    r={4}
                    fill={color}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                );
              })}
            </>
          )}

          {/* X labels */}
          {chart.xLabelIdx.map((i) => (
            <text
              key={data.dates[i]}
              x={chart.xAt(i)}
              y={chart.H - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {fmtThaiDate(data.dates[i])}
            </text>
          ))}
        </svg>

        {/* tooltip */}
        {hoverDate && tooltipRows.length > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 max-h-52 -translate-x-1/2 overflow-y-auto rounded-md bg-foreground px-3 py-2 text-[11px] text-background shadow-lg">
            <p className="mb-1.5 border-b border-background/20 pb-1 font-medium">
              {fmtThaiDate(hoverDate)}
            </p>
            <ul className="space-y-0.5">
              {tooltipRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 tabular-nums">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
                    {r.shortcode}
                  </span>
                  <span>{Math.round(r.revenue).toLocaleString('th-TH')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {data.branches.map((b, bi) => {
          const isHidden = hidden.has(b.id);
          const color = COLORS[bi % COLORS.length];
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleBranch(b.id)}
              className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] transition-opacity ${
                isHidden ? 'opacity-35 line-through' : 'opacity-100'
              }`}
              title={b.name}
            >
              <span
                className="inline-block h-2 w-4 rounded-sm"
                style={{ background: isHidden ? '#cbd5e1' : color }}
              />
              {b.shortcode}
            </button>
          );
        })}
      </div>

      {data.verification && (
        <p className="text-[11px] text-muted-foreground">
          ตรวจยอด {fmtThaiDate(data.verification.date)}: รวมจากกราฟ{' '}
          {baht(data.verification.branchSum)} vs ERP by_branch{' '}
          {baht(data.verification.erpByBranch)}
          {data.verification.match ? (
            <span className="ml-1 text-emerald-600">· ตรงกัน</span>
          ) : (
            <span className="ml-1 text-amber-700">· อาจต่างเล็กน้อย (cache/definition)</span>
          )}
        </p>
      )}
    </div>
  );
}
