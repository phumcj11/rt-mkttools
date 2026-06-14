import type { SignSize } from '@/lib/signs-api';

const SIZE_STYLE: Record<SignSize, { w: string; h: string; left: string; top: string }> = {
  a5: { w: '38%', h: '68%', left: '31%', top: '8%' },
  a6: { w: '34%', h: '58%', left: '33%', top: '14%' },
  a7: { w: '28%', h: '48%', left: '36%', top: '20%' },
  shelf_tag: { w: '72%', h: '16%', left: '14%', top: '54%' },
};

function ShelfSceneBase() {
  return (
    <>
      <defs>
        <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8eef4" />
          <stop offset="100%" stopColor="#c2ccd8" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#wallGrad)" />
      <rect x="4%" y="8%" width="92%" height="52%" rx="2" fill="#fff" opacity="0.35" />
      <rect x="8%" y="22%" width="14%" height="28%" rx="1.5" fill="#4ade80" opacity="0.75" />
      <rect x="24%" y="20%" width="12%" height="30%" rx="1.5" fill="#60a5fa" opacity="0.75" />
      <rect x="38%" y="24%" width="11%" height="26%" rx="1.5" fill="#f472b6" opacity="0.75" />
      <rect x="72%" y="21%" width="13%" height="29%" rx="1.5" fill="#34d399" opacity="0.75" />
      <rect x="86%" y="23%" width="10%" height="27%" rx="1.5" fill="#fb923c" opacity="0.75" />
      <rect x="4%" y="58%" width="92%" height="3%" rx="1" fill="#f1f5f9" />
      <rect x="4%" y="61%" width="92%" height="8%" fill="#64748b" opacity="0.85" />
      <rect x="0%" y="69%" width="100%" height="31%" fill="#b8c4d0" />
    </>
  );
}

export function ShelfSceneMini({ signSize, active }: { signSize: SignSize; active?: boolean }) {
  const pos = SIZE_STYLE[signSize];
  return (
    <svg viewBox="0 0 100 72" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <ShelfSceneBase />
      <rect
        x={pos.left}
        y={pos.top}
        width={pos.w}
        height={pos.h}
        rx="1.5"
        fill={active ? '#dc2626' : '#94a3b8'}
        opacity={active ? 0.95 : 0.65}
        stroke={active ? '#991b1b' : '#64748b'}
        strokeWidth="0.6"
      />
      {signSize === 'shelf_tag' ? (
        <text x="50%" y="62%" textAnchor="middle" fontSize="4" fill="#fff" fontWeight="700">
          TAG
        </text>
      ) : (
        <text x="50%" y="42%" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="800">
          ฿
        </text>
      )}
    </svg>
  );
}

const SIZE_COORDS: Record<SignSize, { x: number; y: number; w: number; h: number }> = {
  a5: { x: 43, y: 8, w: 53, h: 68 },
  a6: { x: 46, y: 14, w: 48, h: 58 },
  a7: { x: 50, y: 20, w: 40, h: 48 },
  shelf_tag: { x: 20, y: 54, w: 100, h: 16 },
};

export function ShelfScenePreview({ signSize }: { signSize: SignSize }) {
  const pos = SIZE_COORDS[signSize];
  return (
    <div className="overflow-hidden rounded-xl border bg-slate-100">
      <svg viewBox="0 0 140 100" className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="wallGradLg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8eef4" />
            <stop offset="100%" stopColor="#c2ccd8" />
          </linearGradient>
        </defs>
        <rect width="140" height="100" fill="url(#wallGradLg)" />
        <rect x="6" y="8" width="128" height="52" rx="3" fill="#fff" opacity="0.35" />
        <rect x="12" y="24" width="13" height="26" rx="2" fill="#4ade80" opacity="0.8" />
        <rect x="32" y="22" width="12" height="28" rx="2" fill="#60a5fa" opacity="0.8" />
        <rect x="48" y="26" width="11" height="24" rx="2" fill="#f472b6" opacity="0.8" />
        <rect x="98" y="23" width="13" height="27" rx="2" fill="#34d399" opacity="0.8" />
        <rect x="116" y="25" width="10" height="25" rx="2" fill="#fb923c" opacity="0.8" />
        <rect x="6" y="58" width="128" height="4" rx="1" fill="#f1f5f9" />
        <rect x="6" y="62" width="128" height="10" fill="#64748b" opacity="0.9" />
        <rect x="0" y="72" width="140" height="28" fill="#b8c4d0" />
        <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h} rx="2" fill="#dc2626" opacity="0.88" stroke="#991b1b" strokeWidth="0.6" />
        <text x={pos.x + pos.w / 2} y={pos.y + pos.h / 2 + 2} textAnchor="middle" fontSize="6" fill="#fff" fontWeight="700">
          {signSize === 'shelf_tag' ? 'SHELF TAG' : 'SIGN'}
        </text>
      </svg>
      <p className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">ตัวอย่างตำแหน่งป้ายบนชั้นวาง</p>
    </div>
  );
}
