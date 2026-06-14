import sharp from 'sharp';
import { SignRequest, SignSize } from '../../database/entities';
import { getSignFormatByTypeSize, SignSlot } from './sign-format-catalog';

export interface RectZone {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TextZone {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  fontSizeRatio: number;
  color: string;
  fontWeight?: number;
  maxChars?: number;
}

export interface SignTemplateZones {
  productImage: RectZone;
  productName?: TextZone;
  price?: TextZone;
  headline?: TextZone;
  promo?: TextZone;
  benefits?: {
    x: number;
    startY: number;
    lineHeightRatio: number;
    fontSizeRatio: number;
    color: string;
  };
}

/** Fractional layout zones per sign size — tuned for 100 Baht Shop–style templates. */
const ZONES: Record<SignSize, SignTemplateZones> = {
  shelf_tag: {
    productImage: { left: 0.22, top: 0.08, width: 0.56, height: 0.80 },
    productName: { x: 0.24, y: 0.93, anchor: 'start', fontSizeRatio: 0.10, color: '#1e3a8a', fontWeight: 800, maxChars: 30 },
    price: { x: 0.80, y: 0.86, anchor: 'middle', fontSizeRatio: 0.26, color: '#dc2626', fontWeight: 900 },
  },
  a5: {
    productImage: { left: 0.10, top: 0.18, width: 0.80, height: 0.50 },
    productName: { x: 0.5, y: 0.15, anchor: 'middle', fontSizeRatio: 0.034, color: '#111827', fontWeight: 800, maxChars: 40 },
    price: { x: 0.5, y: 0.74, anchor: 'middle', fontSizeRatio: 0.095, color: '#dc2626', fontWeight: 900 },
    headline: { x: 0.5, y: 0.82, anchor: 'middle', fontSizeRatio: 0.026, color: '#374151', fontWeight: 700, maxChars: 48 },
    promo: { x: 0.5, y: 0.88, anchor: 'middle', fontSizeRatio: 0.022, color: '#92400e', fontWeight: 600, maxChars: 40 },
    benefits: { x: 0.08, startY: 0.90, lineHeightRatio: 0.04, fontSizeRatio: 0.020, color: '#1f2937' },
  },
  a6: {
    productImage: { left: 0.12, top: 0.20, width: 0.76, height: 0.46 },
    productName: { x: 0.5, y: 0.16, anchor: 'middle', fontSizeRatio: 0.036, color: '#111827', fontWeight: 800, maxChars: 36 },
    price: { x: 0.5, y: 0.72, anchor: 'middle', fontSizeRatio: 0.10, color: '#dc2626', fontWeight: 900 },
    headline: { x: 0.5, y: 0.80, anchor: 'middle', fontSizeRatio: 0.028, color: '#374151', fontWeight: 700, maxChars: 44 },
    promo: { x: 0.5, y: 0.86, anchor: 'middle', fontSizeRatio: 0.024, color: '#92400e', fontWeight: 600, maxChars: 36 },
    benefits: { x: 0.08, startY: 0.90, lineHeightRatio: 0.038, fontSizeRatio: 0.022, color: '#1f2937' },
  },
  a7: {
    productImage: { left: 0.14, top: 0.22, width: 0.72, height: 0.42 },
    productName: { x: 0.5, y: 0.17, anchor: 'middle', fontSizeRatio: 0.032, color: '#111827', fontWeight: 800, maxChars: 32 },
    price: { x: 0.5, y: 0.70, anchor: 'middle', fontSizeRatio: 0.11, color: '#dc2626', fontWeight: 900 },
    headline: { x: 0.5, y: 0.78, anchor: 'middle', fontSizeRatio: 0.026, color: '#374151', fontWeight: 700, maxChars: 40 },
    promo: { x: 0.5, y: 0.84, anchor: 'middle', fontSizeRatio: 0.022, color: '#92400e', fontWeight: 600, maxChars: 32 },
    benefits: { x: 0.08, startY: 0.88, lineHeightRatio: 0.035, fontSizeRatio: 0.020, color: '#1f2937' },
  },
};

function textAnchor(anchor: TextZone['anchor']): string {
  if (anchor === 'middle') return 'middle';
  if (anchor === 'end') return 'end';
  return 'start';
}

function truncate(text: string, max?: number): string {
  if (!max || text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function textEl(
  zone: TextZone | undefined,
  value: string,
  w: number,
  h: number,
  escape: (s: string) => string,
): string {
  if (!zone || !value.trim()) return '';
  const x = Math.round(w * zone.x);
  const y = Math.round(h * zone.y);
  const fontSize = Math.max(12, Math.round(h * zone.fontSizeRatio));
  const weight = zone.fontWeight ?? 700;
  const anchor = textAnchor(zone.anchor);
  const safe = escape(truncate(value.trim(), zone.maxChars));
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${zone.color}">${safe}</text>`;
}

export function renderZoneTextOverlay(
  request: SignRequest,
  fields: Record<string, unknown>,
  w: number,
  h: number,
  escape: (s: string) => string,
  defaultHeadline: string,
): string {
  const zones = ZONES[request.signSize] ?? ZONES.a6;
  const product = String(fields.productName ?? request.productName);
  const price = String(fields.price ?? (request.price != null ? `฿${request.price}` : ''));
  const headline = String(fields.headline ?? defaultHeadline);
  const promo = String(fields.promotion ?? request.promotion ?? '');
  const benefits = Array.isArray(fields.benefits)
    ? fields.benefits.map((v) => String(v)).filter(Boolean).slice(0, 3)
    : [];

  const format = getSignFormatByTypeSize(request.signType, request.signSize);
  const activeSlots = new Set<SignSlot>(format?.slots ?? ['productImage', 'productName', 'price', 'headline']);

  const benefitText = zones.benefits && benefits.length > 0 && activeSlots.has('benefits')
    ? benefits.map((b, i) => {
        const bz = zones.benefits!;
        const x = Math.round(w * bz.x);
        const y = Math.round(h * (bz.startY + i * bz.lineHeightRatio));
        const fontSize = Math.max(11, Math.round(h * bz.fontSizeRatio));
        return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="600" fill="${bz.color}">• ${escape(truncate(b, 42))}</text>`;
      }).join('')
    : '';

  const showPromo = activeSlots.has('promotion') && (request.signType === 'promotion' || Boolean(promo.trim()));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${activeSlots.has('productName') ? textEl(zones.productName, product, w, h, escape) : ''}
  ${activeSlots.has('price') ? textEl(zones.price, price, w, h, escape) : ''}
  ${activeSlots.has('headline') ? textEl(zones.headline, headline, w, h, escape) : ''}
  ${showPromo ? textEl(zones.promo, promo, w, h, escape) : ''}
  ${benefitText}
</svg>`;
}

async function compositeProductInZone(
  productBuffer: Buffer,
  w: number,
  h: number,
  zone: RectZone,
): Promise<{ input: Buffer; left: number; top: number }> {
  const zoneW = Math.round(w * zone.width);
  const zoneH = Math.round(h * zone.height);
  const zoneLeft = Math.round(w * zone.left);
  const zoneTop = Math.round(h * zone.top);
  const padding = Math.max(4, Math.round(Math.min(zoneW, zoneH) * 0.03));
  const innerW = Math.max(1, zoneW - padding * 2);
  const innerH = Math.max(1, zoneH - padding * 2);

  const resized = await sharp(productBuffer)
    .resize(innerW, innerH, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const imgW = meta.width ?? innerW;
  const imgH = meta.height ?? innerH;
  const left = zoneLeft + padding + Math.round((innerW - imgW) / 2);
  const top = zoneTop + padding + Math.round((innerH - imgH) / 2);

  return { input: resized, left, top };
}

export async function composeUploadedTemplate(
  templatePath: string,
  outputPath: string,
  request: SignRequest,
  fields: Record<string, unknown>,
  productBuffer: Buffer | null,
  escape: (s: string) => string,
  defaultHeadline: string,
): Promise<void> {
  const meta = await sharp(templatePath).metadata();
  const w = meta.width ?? 1200;
  const h = meta.height ?? 1400;
  const zones = ZONES[request.signSize] ?? ZONES.a6;

  const format = getSignFormatByTypeSize(request.signType, request.signSize);
  const activeSlots = new Set<SignSlot>(format?.slots ?? ['productImage']);

  const layers: sharp.OverlayOptions[] = [];

  if (productBuffer && activeSlots.has('productImage')) {
    const placed = await compositeProductInZone(productBuffer, w, h, zones.productImage);
    layers.push(placed);
  }

  const overlay = Buffer.from(renderZoneTextOverlay(request, fields, w, h, escape, defaultHeadline));
  layers.push({ input: overlay, blend: 'over' });

  await sharp(templatePath).composite(layers).png().toFile(outputPath);
}
