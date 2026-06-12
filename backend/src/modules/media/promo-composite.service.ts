import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const sharp = require('sharp') as (input?: Buffer | object) => any;

// ---------------------------------------------------------------------------
// Types from promo-layouts.json
// ---------------------------------------------------------------------------

interface TextConfig {
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight?: number;
  valign?: 'top' | 'center' | 'bottom';
  prefix?: string;
}

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
  maskColor: string;
  padding?: number;
  text?: TextConfig;
}

interface PromoLayout {
  canvasW: number;
  canvasH: number;
  slots: Record<string, Slot>;
}

type PromoLayouts = Record<string, PromoLayout>;

// ---------------------------------------------------------------------------

const TEMPLATE_FILE_MAP: Record<string, string> = {
  spend_free_gift: 'promo-spend-free-gift.png',
  buy_x_get_y: 'promo-buy-x-get-y.png',
  bundle_deal: 'promo-bundle-deal.png',
  new_arrival: 'promo-new-arrival.png',
  clearance_sale: 'promo-clearance-sale.png',
};

/** A single sharp composite layer */
interface CompLayer {
  input: Buffer | string;
  left: number;
  top: number;
}

@Injectable()
export class PromoCompositeService {
  private readonly logger = new Logger(PromoCompositeService.name);
  private readonly layouts: PromoLayouts;

  constructor() {
    const layoutsPath = path.join(__dirname, 'promo-layouts.json');
    this.layouts = JSON.parse(fs.readFileSync(layoutsPath, 'utf8')) as PromoLayouts;
  }

  /**
   * Composite a promotion poster.
   * @param promoType  e.g. "spend_free_gift"
   * @param data       form data (text values and image buffers keyed by slot name)
   * @param imageBuffers  map of slot name → Buffer (cutout PNG or original)
   */
  async composite(
    promoType: string,
    data: Record<string, string>,
    imageBuffers: Record<string, Buffer>,
  ): Promise<Buffer> {
    const layout = this.layouts[promoType];
    if (!layout) throw new Error(`Unknown promo type: ${promoType}`);

    const templateBuffer = this.loadTemplate(promoType);
    const layers: CompLayer[] = [];

    for (const [slotName, slot] of Object.entries(layout.slots)) {
      // 1. Mask layer — opaque rect covering the placeholder area
      const maskSvg = this.buildMaskSvg(slot.w, slot.h, slot.maskColor);
      layers.push({ input: Buffer.from(maskSvg), left: slot.x, top: slot.y });

      // 2. Content layer — image or text
      if (imageBuffers[slotName]) {
        const contentBuffer = await this.resizeImage(
          imageBuffers[slotName],
          slot.w,
          slot.h,
          slot.padding ?? 0,
        );
        layers.push({ input: contentBuffer, left: slot.x, top: slot.y });
      } else if (slot.text && data[slotName]) {
        const textSvg = this.buildTextSvg(
          slot.w,
          slot.h,
          data[slotName],
          slot.text,
          slot.padding ?? 0,
        );
        layers.push({ input: Buffer.from(textSvg), left: slot.x, top: slot.y });
      }
    }

    const result = await sharp(templateBuffer)
      .composite(layers)
      .png()
      .toBuffer();

    this.logger.log(`Composited ${promoType}: ${layers.length} layers`);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private loadTemplate(promoType: string): Buffer {
    const filename = TEMPLATE_FILE_MAP[promoType];
    if (!filename) throw new Error(`No template for promo type: ${promoType}`);

    const candidates = [
      path.join(process.cwd(), 'assets', 'promo-templates', filename),
      path.join(process.cwd(), 'dist', 'assets', 'promo-templates', filename),
      path.join(__dirname, '..', '..', 'assets', 'promo-templates', filename),
      path.join(process.cwd(), '..', 'frontend', 'public', 'templates', filename),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p);
    }
    throw new Error(
      `ไม่พบไฟล์ Template PNG สำหรับ ${promoType} — ตรวจสอบ backend/assets/promo-templates/`,
    );
  }

  private buildMaskSvg(w: number, h: number, color: string): Buffer {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${color}"/>
</svg>`;
    return Buffer.from(svg);
  }

  private buildTextSvg(
    w: number,
    h: number,
    text: string,
    cfg: TextConfig,
    padding: number,
  ): Buffer {
    const innerW = w - padding * 2;
    const innerH = h - padding * 2;
    const fontSize = cfg.fontSize;
    const fontWeight = cfg.fontWeight;
    const color = cfg.color;
    const lineHeight = cfg.lineHeight ?? 1.3;
    const prefix = cfg.prefix ?? '';

    // Estimate lines (rough wrap at ~12 chars per 100px)
    const charsPerLine = Math.floor((innerW / fontSize) * 1.8);
    const lines = this.wrapText(prefix + text, charsPerLine);

    // Vertical alignment
    const totalTextH = lines.length * fontSize * lineHeight;
    let startY: number;
    if (cfg.valign === 'bottom') {
      startY = padding + innerH - totalTextH + fontSize * 0.8;
    } else if (cfg.valign === 'top') {
      startY = padding + fontSize;
    } else {
      startY = padding + (innerH - totalTextH) / 2 + fontSize * 0.8;
    }

    // Text anchor
    let anchor = 'middle';
    let x = padding + innerW / 2;
    if (cfg.align === 'left') { anchor = 'start'; x = padding + 4; }
    if (cfg.align === 'right') { anchor = 'end'; x = padding + innerW - 4; }

    const tspans = lines
      .map((line, i) => {
        const dy = i === 0 ? 0 : fontSize * lineHeight;
        return `<tspan x="${x}" dy="${dy}">${this.escapeXml(line)}</tspan>`;
      })
      .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <text
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    fill="${color}"
    text-anchor="${anchor}"
    dominant-baseline="auto"
    x="${x}"
    y="${startY}"
    font-family="sans-serif"
  >${tspans}</text>
</svg>`;
    return Buffer.from(svg);
  }

  private async resizeImage(
    input: Buffer,
    slotW: number,
    slotH: number,
    padding: number,
  ): Promise<Buffer> {
    const innerW = slotW - padding * 2;
    const innerH = slotH - padding * 2;

    const resized = await sharp(input)
      .resize(innerW, innerH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    if (padding === 0) return resized;

    // Embed the resized image with padding into a slotW × slotH transparent canvas
    return sharp({
      create: {
        width: slotW,
        height: slotH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resized, left: padding, top: padding }])
      .png()
      .toBuffer();
  }

  private wrapText(text: string, charsPerLine: number): string[] {
    if (!text) return [''];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > charsPerLine && current) {
        lines.push(current);
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  private escapeXml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
