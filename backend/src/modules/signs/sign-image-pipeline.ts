/**
 * Sign Image Pipeline
 *
 * Step 1: Resolve product image from assets / catalog / ERP
 * Step 2: Optional n8n die-cut (remove background)
 * Step 3: Enhance — add soft drop shadow so product looks 3-D on sign
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export interface ImagePipelineResult {
  buffer: Buffer;
  enhanced: boolean;
  cutoutUsed: boolean;
}

/**
 * Step 3 — Add drop shadow below the product so it looks like it's floating
 * slightly above the template (product appears 3-D / dimensional).
 *
 * Technique: expand canvas, render a blurred dark ellipse centred at the bottom,
 * then place the original product PNG on top.
 */
async function addProductShadow(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 400;
  const h = meta.height ?? 400;

  const padBottom = Math.round(h * 0.10);
  const padSide = Math.round(w * 0.06);
  const totalW = w + padSide * 2;
  const totalH = h + padBottom;

  const shadowW = Math.max(1, Math.round(w * 0.70));
  const shadowH = Math.max(1, Math.round(padBottom * 0.55));
  const shadowX = Math.round((totalW - shadowW) / 2);
  const shadowY = h + Math.round(padBottom * 0.28);

  const shadowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">
  <defs>
    <filter id="blur">
      <feGaussianBlur stdDeviation="${Math.round(shadowH * 0.55)}" />
    </filter>
  </defs>
  <ellipse cx="${shadowX + Math.round(shadowW / 2)}" cy="${shadowY}" rx="${Math.round(shadowW / 2)}" ry="${Math.round(shadowH / 2)}"
    fill="rgba(0,0,0,0.32)" filter="url(#blur)" />
</svg>`;

  const shadowBuffer = Buffer.from(shadowSvg);

  return sharp({
    create: { width: totalW, height: totalH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: shadowBuffer },
      { input, left: padSide, top: 0 },
    ])
    .png()
    .toBuffer();
}

/**
 * Step 2 — Call n8n die-cut webhook if configured.
 * Expects response `{ cutoutBase64: string }` (same contract as media module).
 */
async function callN8nCutout(webhookUrl: string, imageBuffer: Buffer, sku: string): Promise<Buffer> {
  const b64 = imageBuffer.toString('base64');
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: b64, sku }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`n8n sign cutout returned HTTP ${res.status}`);
  const json = (await res.json()) as { cutoutBase64?: string };
  if (!json.cutoutBase64) throw new Error('n8n sign cutout response missing cutoutBase64');
  return Buffer.from(json.cutoutBase64, 'base64');
}

/**
 * Main entry — run all image steps in order.
 *
 * @param rawBuffer   Raw product image bytes (PNG/JPEG/WebP)
 * @param sku         SKU used for n8n request metadata
 * @param n8nWebhook  If truthy, attempt die-cut via n8n before enhancement
 * @param enhance     If true (default), add drop shadow after cutout
 */
export async function runImagePipeline(
  rawBuffer: Buffer,
  sku: string,
  n8nWebhook: string | null | undefined,
  enhance = true,
): Promise<ImagePipelineResult> {
  let buffer = rawBuffer;
  let cutoutUsed = false;

  // Step 2 — die-cut (optional)
  if (n8nWebhook?.startsWith('http')) {
    try {
      buffer = await callN8nCutout(n8nWebhook, rawBuffer, sku);
      cutoutUsed = true;
    } catch {
      // fallback to original — non-fatal
      buffer = rawBuffer;
    }
  }

  // Step 3 — enhancement
  let enhanced = false;
  if (enhance) {
    try {
      buffer = await addProductShadow(buffer);
      enhanced = true;
    } catch {
      // fallback to unenhanced — non-fatal
    }
  }

  return { buffer, enhanced, cutoutUsed };
}

/** Load product image from local file path (assets stored on disk) */
export function loadLocalImage(uploadDir: string, filename: string): Buffer | null {
  const full = path.join(uploadDir, filename);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full);
}

/** Download product image from a URL (catalog / ERP) */
export async function fetchRemoteImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 32 ? buf : null;
  } catch {
    return null;
  }
}
