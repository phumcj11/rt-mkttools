import { SignSize } from '../../database/entities';
import sharp from 'sharp';

const CANVAS_W = 1400;
const CANVAS_H = 1000;

interface Placement {
  width: number;
  height: number;
  left: number;
  top: number;
  rotate?: number;
}

export function shelfMockupPlacement(
  signSize: SignSize,
  signW: number,
  signH: number,
): Placement {
  const isShelfTag = signSize === 'shelf_tag';
  const maxW = isShelfTag ? CANVAS_W * 0.62 : CANVAS_W * 0.38;
  const maxH = isShelfTag ? CANVAS_H * 0.22 : CANVAS_H * 0.72;
  const scale = Math.min(maxW / signW, maxH / signH);
  const width = Math.round(signW * scale);
  const height = Math.round(signH * scale);

  if (isShelfTag) {
    return {
      width,
      height,
      left: Math.round(CANVAS_W * 0.19),
      top: Math.round(CANVAS_H * 0.52),
    };
  }

  const sizeTop: Record<string, number> = {
    a5: 0.14,
    a6: 0.18,
    a7: 0.24,
    shelf_tag: 0.52,
  };
  return {
    width,
    height,
    left: Math.round(CANVAS_W * 0.56 - width / 2),
    top: Math.round(CANVAS_H * (sizeTop[signSize] ?? 0.2)),
    rotate: signSize === 'a5' ? -1.5 : signSize === 'a6' ? -0.8 : 0,
  };
}

export function renderShelfSceneSvg(signSize: SignSize): string {
  const isShelfTag = signSize === 'shelf_tag';
  const w = CANVAS_W;
  const h = CANVAS_H;

  const products = [
    { x: 48, y: 520, pw: 110, ph: 140, color: '#4ade80', label: 'SKU' },
    { x: 168, y: 505, pw: 95, ph: 155, color: '#60a5fa', label: '' },
    { x: 278, y: 530, pw: 88, ph: 130, color: '#f472b6', label: '' },
    { x: 380, y: 515, pw: 102, ph: 145, color: '#fbbf24', label: '' },
    { x: 920, y: 510, pw: 115, ph: 150, color: '#34d399', label: '' },
    { x: 1048, y: 525, pw: 90, ph: 135, color: '#a78bfa', label: '' },
    { x: 1155, y: 508, pw: 100, ph: 152, color: '#fb923c', label: '' },
  ];

  const productBlocks = products.map((p) => `
    <rect x="${p.x}" y="${p.y - p.ph}" width="${p.pw}" height="${p.ph}" rx="6" fill="${p.color}" opacity="0.85"/>
    <rect x="${p.x + 8}" y="${p.y - p.ph + 10}" width="${p.pw - 16}" height="${p.ph - 28}" rx="4" fill="#ffffff" opacity="0.25"/>
  `).join('');

  const shelfY = isShelfTag ? 580 : 660;
  const shelfFront = isShelfTag ? 620 : 700;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8eef4"/>
      <stop offset="55%" stop-color="#d5dee8"/>
      <stop offset="100%" stop-color="#c2ccd8"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#b8c4d0"/>
      <stop offset="100%" stop-color="#9aa8b8"/>
    </linearGradient>
    <linearGradient id="shelfTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <linearGradient id="shelfFrontGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.25"/>
    </filter>
    <radialGradient id="spotlight" cx="50%" cy="20%" r="65%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- wall -->
  <rect width="${w}" height="${h}" fill="url(#wall)"/>
  <rect width="${w}" height="${h}" fill="url(#spotlight)"/>

  <!-- store header strip -->
  <rect x="0" y="0" width="${w}" height="72" fill="#1e293b"/>
  <text x="48" y="46" font-family="Arial Black, Arial, sans-serif" font-size="28" font-weight="900" fill="#f8fafc" letter-spacing="3">100 BAHT SHOP</text>
  <text x="${w - 48}" y="46" text-anchor="end" font-family="Arial, sans-serif" font-size="18" fill="#94a3b8">Retail Shelf Mockup</text>

  <!-- back panel -->
  <rect x="24" y="96" width="${w - 48}" height="${shelfY - 96}" rx="12" fill="#ffffff" opacity="0.35"/>

  ${productBlocks}

  <!-- shelf surface -->
  <rect x="24" y="${shelfY}" width="${w - 48}" height="14" rx="3" fill="url(#shelfTop)"/>
  <rect x="24" y="${shelfFront}" width="${w - 48}" height="36" rx="2" fill="url(#shelfFrontGrad)"/>
  <rect x="24" y="${shelfFront + 34}" width="${w - 48}" height="8" fill="#475569" opacity="0.5"/>

  <!-- price rail for shelf tags -->
  ${isShelfTag ? `<rect x="24" y="${shelfY - 6}" width="${w - 48}" height="10" fill="#e2e8f0" opacity="0.9"/>` : ''}

  <!-- floor -->
  <rect x="0" y="${shelfFront + 42}" width="${w}" height="${h - shelfFront - 42}" fill="url(#floor)"/>
  <ellipse cx="${w / 2}" cy="${shelfFront + 50}" rx="${w * 0.42}" ry="18" fill="#0f172a" opacity="0.08"/>

  <!-- sign placement hint zone (subtle) -->
  <rect x="${isShelfTag ? w * 0.15 : w * 0.48}" y="${isShelfTag ? h * 0.48 : h * 0.12}"
    width="${isShelfTag ? w * 0.55 : w * 0.42}" height="${isShelfTag ? h * 0.18 : h * 0.78}"
    rx="16" fill="#ffffff" opacity="0.06" stroke="#ffffff" stroke-opacity="0.12" stroke-dasharray="8 6"/>

  <!-- ambient label -->
  <text x="${w - 36}" y="${h - 24}" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="#64748b" opacity="0.7">Mockup Preview</text>
</svg>`;
}

async function shadowBuffer(width: number, height: number): Promise<Buffer> {
  const svg = `<svg width="${width + 40}" height="${height + 40}">
    <ellipse cx="${(width + 40) / 2}" cy="${height + 28}" rx="${width * 0.42}" ry="14" fill="black" opacity="0.22"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function composeShelfMockup(
  flatSignPath: string,
  signSize: SignSize,
  outputPath: string,
): Promise<void> {
  const sceneSvg = renderShelfSceneSvg(signSize);
  const bgBuffer = await sharp(Buffer.from(sceneSvg)).png().toBuffer();

  const signMeta = await sharp(flatSignPath).metadata();
  const signW = signMeta.width ?? 800;
  const signH = signMeta.height ?? 600;
  const placement = shelfMockupPlacement(signSize, signW, signH);

  let signPipeline = sharp(flatSignPath).resize(placement.width, placement.height, { fit: 'fill' });
  if (placement.rotate) {
    signPipeline = signPipeline.rotate(placement.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  }
  const signBuffer = await signPipeline.png().toBuffer();
  const resizedMeta = await sharp(signBuffer).metadata();
  const rw = resizedMeta.width ?? placement.width;
  const rh = resizedMeta.height ?? placement.height;

  const shadow = await shadowBuffer(rw, rh);
  const left = placement.left + Math.round((placement.width - rw) / 2);
  const top = placement.top + Math.round((placement.height - rh) / 2);

  await sharp(bgBuffer)
    .composite([
      { input: shadow, top: top + 8, left: left - 10, blend: 'over' },
      { input: signBuffer, top, left, blend: 'over' },
    ])
    .png()
    .toFile(outputPath);
}

export function shelfMockupPreviewDataUrl(signSize: SignSize): string {
  const svg = renderShelfSceneSvg(signSize);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
