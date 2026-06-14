import type { SignSize } from '@/lib/signs-api';

// Mirror the backend scene constants for the frontend SVG mini-previews
const SHELF_TOP_PCT = 64;   // % of viewBox height
const SHELF_FRONT_PCT = 68;
const FLOOR_PCT = 72;

const PRODUCTS_L = [
  { x: 2, w: 6.5, h: 20, color: '#4ade80' },
  { x: 9.5, w: 5.5, h: 22, color: '#60a5fa' },
  { x: 15.5, w: 6, h: 18, color: '#f472b6' },
  { x: 22, w: 7, h: 21, color: '#fbbf24' },
];
const PRODUCTS_R = [
  { x: 71, w: 7, h: 20, color: '#34d399' },
  { x: 79, w: 5.5, h: 18, color: '#a78bfa' },
  { x: 85.5, w: 6.5, h: 21, color: '#fb923c' },
  { x: 93, w: 5, h: 19, color: '#f43f5e' },
];

// Sign rectangle position/size in % of viewBox for each size
const SIGN_ZONE: Record<SignSize, { x: number; y: number; w: number; h: number }> = {
  a5: { x: 36, y: 4, w: 28, h: 60 },
  a6: { x: 36, y: 10, w: 28, h: 52 },
  a7: { x: 37, y: 18, w: 26, h: 44 },
  shelf_tag: { x: 31, y: 49, w: 38, h: 15 },
};

function SceneBase({ vw, vh, activeSign, signSize }: {
  vw: number; vh: number; activeSign?: boolean; signSize: SignSize;
}) {
  const st = (SHELF_TOP_PCT / 100) * vh;
  const sf = (SHELF_FRONT_PCT / 100) * vh;
  const fl = (FLOOR_PCT / 100) * vh;
  const sz = SIGN_ZONE[signSize];

  return (
    <>
      <defs>
        <linearGradient id="bgG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eef2f7" />
          <stop offset="100%" stopColor="#c8d4e0" />
        </linearGradient>
        <linearGradient id="shG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="sfG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>

      {/* wall */}
      <rect width={vw} height={vh} fill="url(#bgG)" />
      <rect x={1} y={1} width={vw - 2} height={st - 1} rx={2} fill="#fff" fillOpacity={0.25} />

      {/* products left */}
      {PRODUCTS_L.map((p, i) => {
        const px = (p.x / 100) * vw;
        const pw = (p.w / 100) * vw;
        const ph = (p.h / 100) * vh;
        return (
          <g key={i}>
            <rect x={px} y={st - ph} width={pw} height={ph} rx={1.5} fill={p.color} opacity={0.85} />
            <rect x={px + 2} y={st - ph + 3} width={pw - 4} height={ph * 0.5} rx={1} fill="#fff" opacity={0.22} />
          </g>
        );
      })}

      {/* products right */}
      {PRODUCTS_R.map((p, i) => {
        const px = (p.x / 100) * vw;
        const pw = (p.w / 100) * vw;
        const ph = (p.h / 100) * vh;
        return (
          <g key={i}>
            <rect x={px} y={st - ph} width={pw} height={ph} rx={1.5} fill={p.color} opacity={0.85} />
            <rect x={px + 2} y={st - ph + 3} width={pw - 4} height={ph * 0.5} rx={1} fill="#fff" opacity={0.22} />
          </g>
        );
      })}

      {/* shelf */}
      <rect x={0} y={st} width={vw} height={sf - st} fill="url(#shG)" />
      <rect x={0} y={sf} width={vw} height={fl - sf} fill="url(#sfG)" />
      <rect x={0} y={fl - 2} width={vw} height={3} fill="#334155" opacity={0.5} />

      {/* floor */}
      <rect x={0} y={fl} width={vw} height={vh - fl} fill="#b8c6d4" />

      {/* sign placeholder */}
      <rect
        x={(sz.x / 100) * vw}
        y={(sz.y / 100) * vh}
        width={(sz.w / 100) * vw}
        height={(sz.h / 100) * vh}
        rx={1.5}
        fill={activeSign ? '#dc2626' : '#475569'}
        opacity={activeSign ? 0.9 : 0.45}
        stroke={activeSign ? '#991b1b' : '#64748b'}
        strokeWidth={0.7}
      />
      {activeSign && (
        <text
          x={((sz.x + sz.w / 2) / 100) * vw}
          y={((sz.y + sz.h / 2 + 1.5) / 100) * vh}
          textAnchor="middle"
          fontSize={signSize === 'shelf_tag' ? 3.5 : 5}
          fontWeight={700}
          fill="#fff"
        >
          {signSize === 'shelf_tag' ? 'TAG' : '฿'}
        </text>
      )}
    </>
  );
}

/** Tiny icon used inside the SignSizePicker buttons */
export function ShelfSceneMini({ signSize, active }: { signSize: SignSize; active?: boolean }) {
  return (
    <svg viewBox="0 0 100 72" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <SceneBase vw={100} vh={72} activeSign={active} signSize={signSize} />
    </svg>
  );
}

/** Larger preview below the size picker */
export function ShelfScenePreview({ signSize }: { signSize: SignSize }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-slate-50">
      <svg viewBox="0 0 160 100" className="w-full" preserveAspectRatio="xMidYMid meet">
        <SceneBase vw={160} vh={100} activeSign signSize={signSize} />
      </svg>
      <p className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">
        ตัวอย่างตำแหน่งป้ายบนชั้นวาง
      </p>
    </div>
  );
}
