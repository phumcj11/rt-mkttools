import { SignSize } from '../../database/entities';
import sharp from 'sharp';

// Scene canvas: 1600 wide × 900 tall (16:9 ish)
const W = 1600;
const H = 900;

// Key vertical reference points
const HEADER_H = 0;       // no header bar – keep it clean
const SHELF_TOP_Y = 580;  // top surface of the shelf
const SHELF_FRONT_Y = 610;// front face of shelf board
const SHELF_BOTTOM_Y = 650;
const FLOOR_Y = 650;

// Horizontal "gap" zone in the middle where the sign stands (products on each side)
const GAP_START = 480;
const GAP_END = 1120;
const GAP_CENTER = (GAP_START + GAP_END) / 2;  // 800

const PRODUCTS_LEFT = [
  { x: 30, w: 100, h: 170, color: '#4ade80' },
  { x: 145, w: 85, h: 190, color: '#60a5fa' },
  { x: 244, w: 92, h: 160, color: '#f472b6' },
  { x: 350, w: 108, h: 180, color: '#fbbf24' },
];

const PRODUCTS_RIGHT = [
  { x: 1130, w: 108, h: 175, color: '#34d399' },
  { x: 1252, w: 90, h: 160, color: '#a78bfa' },
  { x: 1356, w: 100, h: 182, color: '#fb923c' },
  { x: 1470, w: 80, h: 165, color: '#f43f5e' },
];

function renderProduct(x: number, w: number, h: number, color: string): string {
  const y = SHELF_TOP_Y;
  return `
    <rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="8" fill="${color}" opacity="0.82"/>
    <rect x="${x + 6}" y="${y - h + 8}" width="${w - 12}" height="${h * 0.55}" rx="5" fill="#ffffff" opacity="0.22"/>
    <rect x="${x + 10}" y="${y - h * 0.35}" width="${w - 20}" height="4" rx="2" fill="#ffffff" opacity="0.35"/>
    <rect x="${x + 10}" y="${y - h * 0.35 + 10}" width="${w - 34}" height="4" rx="2" fill="#ffffff" opacity="0.22"/>
  `;
}

export function renderShelfSceneSvg(signSize: SignSize): string {
  const isShelfTag = signSize === 'shelf_tag';

  const productBlocks = [
    ...PRODUCTS_LEFT.map((p) => renderProduct(p.x, p.w, p.h, p.color)),
    ...PRODUCTS_RIGHT.map((p) => renderProduct(p.x, p.w, p.h, p.color)),
  ].join('');

  // Sign placeholder region (where the composited sign will sit)
  const signZoneX = GAP_START + 20;
  const signZoneW = GAP_END - GAP_START - 40;
  const signZoneTop = isShelfTag ? SHELF_TOP_Y - 140 : 80;
  const signZoneH = isShelfTag ? 140 : SHELF_TOP_Y - 80 - 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#eef2f7"/>
      <stop offset="72%" stop-color="#dce4ee"/>
      <stop offset="100%" stop-color="#c8d4e0"/>
    </linearGradient>
    <linearGradient id="shelfSurface" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="40%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <linearGradient id="shelfFace" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c0ccd8"/>
      <stop offset="100%" stop-color="#8fa0b2"/>
    </linearGradient>
    <radialGradient id="ceilingLight" cx="50%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="dropShadow">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.30"/>
    </filter>
  </defs>

  <!-- background wall -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
  <rect width="${W}" height="${H}" fill="url(#ceilingLight)"/>

  <!-- back wall panel (lighter area) -->
  <rect x="20" y="20" width="${W - 40}" height="${SHELF_TOP_Y - 20}" rx="4" fill="#ffffff" opacity="0.28"/>

  <!-- products left + right -->
  ${productBlocks}

  <!-- shelf top surface -->
  <rect x="0" y="${SHELF_TOP_Y}" width="${W}" height="18" fill="url(#shelfSurface)"/>
  <!-- shelf front face -->
  <rect x="0" y="${SHELF_FRONT_Y}" width="${W}" height="${SHELF_BOTTOM_Y - SHELF_FRONT_Y}" fill="url(#shelfFace)"/>
  <!-- shelf bottom edge -->
  <rect x="0" y="${SHELF_BOTTOM_Y - 4}" width="${W}" height="6" fill="#334155" opacity="0.55"/>

  <!-- price rail strip -->
  <rect x="0" y="${SHELF_FRONT_Y}" width="${W}" height="8" fill="#e8ecf0" opacity="0.75"/>

  <!-- floor -->
  <rect x="0" y="${FLOOR_Y}" width="${W}" height="${H - FLOOR_Y}" fill="url(#floorGrad)"/>
  <!-- floor reflection -->
  <ellipse cx="${W / 2}" cy="${FLOOR_Y + 30}" rx="${W * 0.38}" ry="22" fill="#0f172a" opacity="0.07"/>

  <!-- sign zone placeholder (subtle) -->
  <rect x="${signZoneX}" y="${signZoneTop}" width="${signZoneW}" height="${signZoneH}" rx="12"
    fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.10" stroke-dasharray="10 7"/>

  <!-- store label (bottom right) -->
  <text x="${W - 28}" y="${H - 20}" text-anchor="end" font-family="Arial, sans-serif" font-size="18" fill="#64748b" opacity="0.55">Mockup Preview</text>
</svg>`;
}

// ── Placement ──────────────────────────────────────────────────────────────────

interface Placement {
  width: number;
  height: number;
  left: number;
  top: number;
}

function calcPlacement(signSize: SignSize, signW: number, signH: number): Placement {
  const isShelfTag = signSize === 'shelf_tag';
  const gapW = GAP_END - GAP_START;

  let maxW: number;
  let maxH: number;

  if (isShelfTag) {
    // shelf tag sits in the gap on the price rail — use full gap width
    maxW = gapW - 40;
    maxH = 160; // real shelf tags are short
  } else {
    // portrait sign stands tall above the shelf
    maxW = gapW - 80;
    maxH = SHELF_TOP_Y - 60;  // from near top to shelf surface
  }

  const scale = Math.min(maxW / signW, maxH / signH);
  const width = Math.round(signW * scale);
  const height = Math.round(signH * scale);

  let left: number;
  let top: number;

  if (isShelfTag) {
    left = Math.round(GAP_CENTER - width / 2);
    top = SHELF_TOP_Y - height;  // sits flush on the shelf surface
  } else {
    left = Math.round(GAP_CENTER - width / 2);
    top = Math.max(60, SHELF_TOP_Y - height - 10);  // floating above shelf
  }

  return { width, height, left, top };
}

// ── Shadow ────────────────────────────────────────────────────────────────────

async function makeShadow(w: number, h: number, isShelfTag: boolean): Promise<Buffer> {
  if (isShelfTag) {
    // thin ellipse under/behind shelf tag
    const sw = w + 60;
    const sh = 30;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}">
      <ellipse cx="${sw / 2}" cy="18" rx="${w * 0.46}" ry="10" fill="#0f172a" opacity="0.25"/>
    </svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
  // drop shadow behind standing sign
  const sw = w + 80;
  const sh = h + 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}">
    <rect x="20" y="20" width="${w}" height="${h}" rx="16" fill="#0f172a" opacity="0.22"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Main compose ──────────────────────────────────────────────────────────────

export async function composeShelfMockup(
  flatSignPath: string,
  signSize: SignSize,
  outputPath: string,
): Promise<void> {
  const isShelfTag = signSize === 'shelf_tag';

  const bgBuffer = await sharp(Buffer.from(renderShelfSceneSvg(signSize))).png().toBuffer();

  const meta = await sharp(flatSignPath).metadata();
  const signW = meta.width ?? 800;
  const signH = meta.height ?? 600;
  const pl = calcPlacement(signSize, signW, signH);

  const signBuffer = await sharp(flatSignPath)
    .resize(pl.width, pl.height, { fit: 'fill' })
    .png()
    .toBuffer();

  const shadow = await makeShadow(pl.width, pl.height, isShelfTag);
  const shadowLeft = pl.left - 10;
  const shadowTop = isShelfTag ? pl.top + pl.height - 10 : pl.top + 10;

  const composites: sharp.OverlayOptions[] = [
    { input: shadow, left: Math.max(0, shadowLeft), top: Math.max(0, shadowTop), blend: 'multiply' },
    { input: signBuffer, left: Math.max(0, pl.left), top: Math.max(0, pl.top), blend: 'over' },
  ];

  await sharp(bgBuffer).composite(composites).png().toFile(outputPath);
}
