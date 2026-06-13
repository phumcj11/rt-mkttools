import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpProductCache } from '../../database/entities/erp-product-cache.entity';
import { OpenAiService } from '../ai/openai.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { PromoCompositeService } from './promo-composite.service';

export interface ProductMediaResult {
  sku: string;
  productName: string;
  imageUrl: string;
  benefits: string;
  benefitLines: string[];
  originalImageUrl: string;
  generatedAt: string;
  source: 'benefit_poster' | 'gpt_image';
  price: string;
  category: string;
}

export interface PromoGptResult {
  imageUrl: string;
  filename: string;
  model: string;
  promptUsed: string;
  generatedAt: string;
  source: 'gpt_image';
}

export interface PromoCompositeResult {
  imageUrl: string;
  filename: string;
  generatedAt: string;
  source: 'composite';
  cutoutUsed: boolean;
}

// ---------------------------------------------------------------------------
// POP Sticker types
// ---------------------------------------------------------------------------

export interface PopStickerCopy {
  headline: string;
  subheadline: string;
  benefits: string[];
  badges: string[];
}

export interface PopStickerVariation {
  styleId: string;
  styleName: string;
  imageUrl: string;
  filename: string;
  promptUsed: string;
  model: string;
  cutoutUsed: boolean;
  branded?: boolean;
}

export interface PopStickerResult {
  sku: string;
  productName: string;
  copy: PopStickerCopy;
  variations: PopStickerVariation[];
  generatedAt: string;
  productImageSize?: { width: number; height: number };
}

export interface BrandAsset {
  filename: string;
  kind: 'logo' | 'mascot';
  url: string;
  createdAt: string;
}

export interface PopStickerOptions {
  includeBranded?: boolean;
  brandAssetFilenames?: string[];
  brandedCount?: number;
}

const PROMO_TYPE_LABELS: Record<string, string> = {
  spend_free_gift: 'Spend & Free Gift — ซื้อครบ X บาท รับของแถม',
  buy_x_get_y: 'Buy X Get Y — ซื้อ X ได้ Y ฟรี',
  bundle_deal: 'Bundle Deal — จัดเซตสินค้าราคาพิเศษ',
  new_arrival: 'New Arrival — สินค้าใหม่เข้าร้าน',
  clearance_sale: 'Clearance Sale — ลดแรง สินค้าจำกัด',
};

const PROMO_TEMPLATE_FILES: Record<string, string> = {
  spend_free_gift: 'promo-spend-free-gift.png',
  buy_x_get_y: 'promo-buy-x-get-y.png',
  bundle_deal: 'promo-bundle-deal.png',
  new_arrival: 'promo-new-arrival.png',
  clearance_sale: 'promo-clearance-sale.png',
};

/** Layout description per template — guides AI when editing the template PNG */
const PROMO_TEMPLATE_LAYOUTS: Record<string, string> = {
  spend_free_gift: [
    'Template layout to preserve:',
    '- LEFT: large product photo box (replace [PRODUCT_IMAGE] with real product photo)',
    '- TOP RIGHT: "SPEND" headline, white box with spend amount in THB, "or more in-store" text',
    '- MIDDLE RIGHT: yellow/gold FREE GIFT banner (replace [FREE_GIFT] with gift description in Thai)',
    '- BOTTOM: valid date bar (replace [VALID_DATE])',
    '- Keep: 100 BAHT SHOP logo, red elephant mascot, red/white theme, decorative elements',
  ].join('\n'),
  buy_x_get_y: [
    'Template layout to preserve:',
    '- LEFT: main product photo (replace [PRODUCT_IMAGE])',
    '- TOP RIGHT: "BUY X GET Y" headline',
    '- BOTTOM RIGHT: two boxes labeled BUY and GET (replace [BUY_PRODUCT] and [GET_PRODUCT] with product names/images)',
    '- BOTTOM: valid date bar',
    '- Keep: branding, mascot, red/white theme',
  ].join('\n'),
  bundle_deal: [
    'Template layout to preserve:',
    '- LEFT: product 1 photo + name label (replace [PRODUCT_1_IMAGE], [PRODUCT_1_NAME])',
    '- CENTER: product 2 photo + name + plus sign (replace [PRODUCT_2_IMAGE], [PRODUCT_2_NAME])',
    '- RIGHT: starburst with bundle price "ONLY X THB" (replace [PRICE])',
    '- RIGHT BOTTOM: yellow FREE gift box (replace [FREE_GIFT_IMAGE] text)',
    '- BOTTOM: valid date bar',
    '- Keep: BUNDLE DEAL headline, mascot, branding',
  ].join('\n'),
  new_arrival: [
    'Template layout to preserve:',
    '- LEFT: product photo (replace [PRODUCT_IMAGE])',
    '- TOP RIGHT: "NEW ARRIVAL" headline and Thai subheadline',
    '- BOTTOM RIGHT: 3 feature boxes (replace [FEATURE_1], [FEATURE_2], [FEATURE_3] with Thai text)',
    '- BOTTOM: valid date bar with calendar icon',
    '- Keep: NEW badges, mascot, branding',
  ].join('\n'),
  clearance_sale: [
    'Template layout to preserve:',
    '- LEFT: main product photo + name bar (replace [PRODUCT_IMAGE], [PRODUCT_NAME])',
    '- TOP RIGHT: "CLEARANCE SALE" + discount starburst (replace discount % in UP TO % OFF area)',
    '- BOTTOM RIGHT: 3 small product slots with price and name (replace each [PRODUCT_IMAGE], [PRICE], [PRODUCT_NAME], SAVE %)',
    '- BOTTOM: valid date bar',
    '- Keep: Thai "ลดแรง" ribbon, mascot, branding',
  ].join('\n'),
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadsDir: string;
  private readonly brandAssetsDir: string;

  constructor(
    @InjectRepository(ErpProductCache)
    private readonly productRepo: Repository<ErpProductCache>,
    private readonly openAi: OpenAiService,
    private readonly settings: SystemSettingsService,
    private readonly composite: PromoCompositeService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'media');
    this.brandAssetsDir = path.join(this.uploadsDir, 'brand-assets');
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    fs.mkdirSync(this.brandAssetsDir, { recursive: true });
  }

  async listProducts(limit = 50, offset = 0) {
    return this.productRepo.find({
      order: { syncedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Step 1: AI generates Thai benefit copy.
   * Step 2 (frontend): renders benefit poster with html-to-image, uploads via savePosterImage().
   */
  async generateBenefitImage(sku: string): Promise<ProductMediaResult> {
    const product = await this.productRepo.findOneBy({ sku });
    if (!product) throw new Error(`ไม่พบสินค้า SKU "${sku}" ใน cache — ซิงค์ ERP ก่อน`);

    const benefits = await this.generateBenefits(product);
    const benefitLines = this.parseBenefitLines(benefits);

    return {
      sku,
      productName: product.name,
      imageUrl: '',
      benefits,
      benefitLines,
      originalImageUrl: product.imageUrl,
      generatedAt: new Date().toISOString(),
      source: 'benefit_poster',
      price: product.retailPrice,
      category: product.category,
    };
  }

  /** Save client-rendered benefit poster PNG */
  async savePosterImage(sku: string, dataUrl: string): Promise<{ imageUrl: string; filename: string }> {
    const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!match) throw new BadRequestException('Invalid image data');

    const filename = `product-${this.safeFilename(sku)}-${Date.now()}.png`;
    const localPath = path.join(this.uploadsDir, filename);

    try {
      fs.writeFileSync(localPath, Buffer.from(match[1], 'base64'));
    } catch (err) {
      this.logger.error(`Failed to save poster image: ${String(err)}`);
      throw new BadRequestException('Cannot write image file — check server uploads directory permissions');
    }

    return { imageUrl: `/media/serve/${filename}`, filename };
  }

  /**
   * Generate benefit poster via GPT Image (images.edit with ERP photo, or images.generate).
   */
  async generateGptBenefitImage(sku: string): Promise<ProductMediaResult> {
    const product = await this.productRepo.findOneBy({ sku });
    if (!product) throw new Error(`ไม่พบสินค้า SKU "${sku}" ใน cache — ซิงค์ ERP ก่อน`);

    const benefits = await this.generateBenefits(product);
    const benefitLines = this.parseBenefitLines(benefits);
    const prompt = this.buildGptImagePrompt(product, benefitLines);

    this.logger.log(`GPT Image generating for ${sku}…`);

    let imageResult;
    if (product.imageUrl) {
      const { buffer: imgBuf, contentType } = await this.proxyImage(product.imageUrl);
      imageResult = await this.openAi.editGptImage(prompt, imgBuf, contentType);
    } else {
      imageResult = await this.openAi.generateGptImage(prompt);
    }

    const filename = `product-gpt-${this.safeFilename(sku)}-${Date.now()}.png`;
    const localPath = path.join(this.uploadsDir, filename);
    fs.writeFileSync(localPath, imageResult.buffer);

    this.logger.log(`GPT Image saved ${filename} (model: ${imageResult.model})`);

    return {
      sku,
      productName: product.name,
      imageUrl: `/media/serve/${filename}`,
      benefits,
      benefitLines,
      originalImageUrl: product.imageUrl,
      generatedAt: new Date().toISOString(),
      source: 'gpt_image',
      price: product.retailPrice,
      category: product.category,
    };
  }

  async batchGenerateBenefitImages(skus: string[]): Promise<{
    success: ProductMediaResult[];
    failed: { sku: string; error: string }[];
  }> {
    const success: ProductMediaResult[] = [];
    const failed: { sku: string; error: string }[] = [];
    for (const sku of skus) {
      try {
        success.push(await this.generateBenefitImage(sku));
      } catch (err: unknown) {
        failed.push({ sku, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { success, failed };
  }

  listGeneratedFiles(): { filename: string; url: string; createdAt: string }[] {
    if (!fs.existsSync(this.uploadsDir)) return [];
    return fs
      .readdirSync(this.uploadsDir)
      .filter((f) => f !== 'brand-assets' && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.mp4')))
      .map((filename) => {
        const stat = fs.statSync(path.join(this.uploadsDir, filename));
        return {
          filename,
          url: `/media/serve/${filename}`,
          createdAt: stat.birthtime.toISOString(),
          size: stat.size,
        };
      })
      .filter((file) => !file.filename.endsWith('.mp4') || file.size > 1024)
      .map(({ size: _size, ...file }) => file)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  deleteGeneratedFile(filename: string): { ok: boolean; filename: string } {
    const safe = path.basename(filename);
    if (!safe || safe !== filename || safe === 'brand-assets') {
      throw new BadRequestException('Invalid media filename');
    }
    if (!/\.(png|jpg|jpeg|webp|mp4)$/i.test(safe)) {
      throw new BadRequestException('Unsupported media file type');
    }

    const filePath = path.join(this.uploadsDir, safe);
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('Media file not found');
    }

    fs.unlinkSync(filePath);
    return { ok: true, filename: safe };
  }

  listBrandAssets(): BrandAsset[] {
    if (!fs.existsSync(this.brandAssetsDir)) return [];
    return fs
      .readdirSync(this.brandAssetsDir)
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map((filename) => {
        const stat = fs.statSync(path.join(this.brandAssetsDir, filename));
        const kind: 'logo' | 'mascot' = filename.includes('mascot') ? 'mascot' : 'logo';
        return {
          filename,
          kind,
          url: `/media/brand-assets/${filename}`,
          createdAt: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  saveBrandAsset(kind: 'logo' | 'mascot', dataUrl: string): BrandAsset {
    const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
    if (!match) throw new BadRequestException('Brand asset ต้องเป็น data URL ของรูปภาพ png/jpg/webp');
    const mime = match[1].toLowerCase();
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const filename = `brand-${kind}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(this.brandAssetsDir, filename), Buffer.from(match[2], 'base64'));
    return {
      filename,
      kind,
      url: `/media/brand-assets/${filename}`,
      createdAt: new Date().toISOString(),
    };
  }

  getBrandAssetPath(filename: string): string {
    const safe = path.basename(filename);
    const filePath = path.join(this.brandAssetsDir, safe);
    if (!fs.existsSync(filePath)) throw new BadRequestException('Brand asset not found');
    return filePath;
  }

  async getDriveFolderId(): Promise<string | null> {
    return this.settings.get('google_drive_folder_id');
  }

  async proxyImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Invalid image URL');
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Cannot fetch image: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    return { buffer, contentType };
  }

  private async generateBenefits(product: ErpProductCache): Promise<string> {
    const prompt = product.imageUrl
      ? `ดูรูปสินค้าและเขียนสรรพคุณ/จุดเด่น 5 ข้อ เป็นภาษาไทย แต่ละข้อสั้นกระชับ ไม่เกิน 2 บรรทัด
รูปแบบ:
1. ...
2. ...
3. ...
4. ...
5. ...

สินค้า: ${product.name}
หมวด: ${product.category}
ราคา: ฿${product.retailPrice}`
      : `เขียนสรรพคุณ/จุดเด่น 5 ข้อ เป็นภาษาไทย แต่ละข้อสั้นกระชับ
รูปแบบ:
1. ...
2. ...
3. ...
4. ...
5. ...

สินค้า: ${product.name}
หมวด: ${product.category}
ราคา: ฿${product.retailPrice}`;

    try {
      if (product.imageUrl) {
        return await this.openAi.analyzeImage(product.imageUrl, prompt);
      }
      const res = await this.openAi.complete(
        'คุณเป็นนักเขียน copy การตลาดสินค้าปลีก ตอบเป็นภาษาไทยเท่านั้น ใช้รูปแบบ 1. 2. 3.',
        prompt,
      );
      return res.content;
    } catch (err) {
      this.logger.warn(`Benefits generation failed: ${String(err)}`);
      if (err instanceof Error && err.message === 'OPENAI_NOT_CONFIGURED') {
        throw new Error('ยังไม่ได้ตั้งค่า OpenAI API Key — ไปที่ หน้าตั้งค่า → AI Configuration');
      }
      return [
        '1. สินค้าคุณภาพ ราคาคุ้มค่า',
        '2. เหมาะสำหรับใช้ในชีวิตประจำวัน',
        '3. หาซื้อได้ที่ 100 Baht Shop',
        `4. ราคา ฿${product.retailPrice}`,
        `5. หมวด ${product.category}`,
      ].join('\n');
    }
  }

  private parseBenefitLines(benefits: string): string[] {
    return benefits
      .split('\n')
      .map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((l) => l.length > 3)
      .slice(0, 5);
  }

  private buildGptImagePrompt(product: ErpProductCache, benefitLines: string[]): string {
    const benefitsText = benefitLines.map((l, i) => `${i + 1}. ${l}`).join('\n');
    return [
      'Create a professional Thai retail marketing poster for this product.',
      `Product: ${product.name}`,
      `Category: ${product.category}`,
      `Price: ${product.retailPrice} Baht (show prominently as ฿${product.retailPrice})`,
      '',
      'Include these product benefits as readable Thai text on the poster:',
      benefitsText,
      '',
      'Design requirements:',
      '- Clean modern layout, red and white retail color scheme',
      '- Keep the product packaging recognizable from the input image',
      '- Include "100 Baht Shop Thailand" branding at the bottom',
      '- Professional quality suitable for social media and in-store display',
      '- All benefit text must be in Thai language',
    ].join('\n');
  }

  // ---------------------------------------------------------------------------
  // POP Sticker Generator
  // ---------------------------------------------------------------------------

  private static readonly POP_SAFE_WORDS = [
    'Supports', 'Helps maintain', 'Daily wellness', 'Natural goodness',
    'Rich in natural antioxidants', 'Rich in', 'Good source of',
  ];

  private static readonly POP_BANNED_WORDS = [
    'Cure', 'Treat', 'Prevent disease', 'Guaranteed result',
    'Medicine', 'Doctor recommended', 'Clinically proven', 'Heals',
  ];

  /** 4 fixed shelf sticker styles */
  private static readonly POP_STYLES = [
    {
      id: 'style_01',
      name: 'Healthy Aging Premium',
      mood: 'Clean Japanese pharmacy style, white background, gold and black color theme.',
      badge: 'Best Seller',
    },
    {
      id: 'style_02',
      name: 'Natural Beauty From Inside',
      mood: 'Luxury wellness and beauty supplement style, premium gold accents, modern clean layout.',
      badge: 'Premium Quality',
    },
    {
      id: 'style_03',
      name: 'Tourist Favorite Retail POP',
      mood: 'Bright retail promotional sticker for tourist stores, attractive, easy to notice from 5 meters away.',
      badge: 'Popular in Thailand',
    },
    {
      id: 'style_04',
      name: 'Japanese Drugstore Best Seller',
      mood: 'Watsons / Matsumoto Kiyoshi inspired shelf talker, clean white background, gold premium frame.',
      badge: 'Tourist Favorite',
    },
  ];

  /**
   * ChatGPT-style POP Sticker workflow:
   * 1. Fetch ERP product image and analyze visual facts
   * 2. Generate claim-safe retail copy from cleaned product name
   * 3. GPT Image uses ERP photo as reference and creates the full die-cut sticker
   * 4. Save 4 final PNG files
   */
  async generatePopStickers(sku: string, options: PopStickerOptions = {}): Promise<PopStickerResult> {
    const sharp = require('sharp') as (input?: Buffer | object) => any;
    const product = await this.productRepo.findOneBy({ sku });
    if (!product) throw new BadRequestException(`ไม่พบสินค้า SKU "${sku}" ใน cache — ซิงค์ ERP ก่อน`);

    this.logger.log(`POP Sticker ChatGPT-style generating for SKU: ${sku}`);

    const cleanProductName = this.cleanPopProductName(product.name, sku);

    // Step 1: fetch + analyze product image
    let visualFacts = `Product: ${cleanProductName}. Category: ${product.category}.`;
    let productImageBuffer: Buffer | null = null;
    let productImageMime = 'image/jpeg';
    let productImageSize: { width: number; height: number } | undefined;

    if (product.imageUrl) {
      try {
        const { buffer, contentType } = await this.proxyImage(product.imageUrl);
        productImageBuffer = buffer;
        productImageMime = contentType;
        const meta = await sharp(buffer).metadata();
        productImageSize = { width: meta.width ?? 0, height: meta.height ?? 0 };
        const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
        const analysis = await this.openAi.analyzeImage(
          dataUrl,
          [
            'Describe only the actual product package/bottle appearance in 3-4 sentences.',
            'Mention package shape, label colors, ingredient visuals, capsule/bottle form, and useful design cues.',
            'Ignore catalog-card/UI text such as SKU codes, product codes, price, website labels, or surrounding ERP card text.',
            'Used for retail POP sticker design.',
          ].join(' '),
        );
        if (analysis) visualFacts = analysis;
      } catch (err) {
        this.logger.warn(`POP: product image fetch/analysis failed: ${String(err)}`);
      }
    }

    // Step 2: claim-safe copy
    const copy = await this.generatePopCopy(cleanProductName, product.category, product.retailPrice, visualFacts);

    // Step 3 & 4: per style — GPT Image generates full sticker from reference image
    const timestamp = Date.now();
    const variations: PopStickerVariation[] = [];
    const selectedBrandAssets = this.loadSelectedBrandAssets(options.brandAssetFilenames ?? []);
    const includeBranded = !!options.includeBranded && selectedBrandAssets.length > 0;

    for (const style of MediaService.POP_STYLES) {
      try {
        const prompt = this.buildPopStickerPrompt(cleanProductName, copy, visualFacts, style);
        const imageResult = productImageBuffer
          ? await this.openAi.editGptImage(prompt, productImageBuffer, productImageMime, { size: '1024x1024' })
          : await this.openAi.generateGptImage(prompt, { size: '1024x1024' });

        const prepared = await this.prepareTransparentPopSticker(
          sharp,
          imageResult.buffer,
          `${sku}-${style.id}`,
        );
        const filename = `pop-${this.safeFilename(sku)}-${style.id}-${timestamp}.png`;
        const localPath = path.join(this.uploadsDir, filename);
        fs.writeFileSync(localPath, prepared.buffer);

        variations.push({
          styleId: style.id,
          styleName: style.name,
          imageUrl: `/media/serve/${filename}`,
          filename,
          promptUsed: prompt,
          model: imageResult.model,
          cutoutUsed: prepared.cutoutUsed,
        });
        this.logger.log(`POP saved: ${filename} (${style.name}, model: ${imageResult.model})`);
      } catch (err) {
        this.logger.error(`POP style ${style.id} failed: ${String(err)}`);
        variations.push({
          styleId: style.id,
          styleName: style.name,
          imageUrl: '',
          filename: '',
          promptUsed: '',
          model: '',
          cutoutUsed: false,
        });
      }
    }

    if (includeBranded) {
      const brandedStyles = this.buildBrandedPopStyles(Math.max(1, Math.min(options.brandedCount ?? 2, 4)));
      const brandRef = productImageBuffer
        ? await this.buildBrandReferenceSheet(sharp, productImageBuffer, selectedBrandAssets)
        : null;

      for (const style of brandedStyles) {
        try {
          const prompt = this.buildBrandedPopStickerPrompt(cleanProductName, copy, visualFacts, style, selectedBrandAssets);
          const imageResult = brandRef
            ? await this.openAi.editGptImage(prompt, brandRef, 'image/png', { size: '1024x1024' })
            : await this.openAi.generateGptImage(prompt, { size: '1024x1024' });

          const prepared = await this.prepareTransparentPopSticker(
            sharp,
            imageResult.buffer,
            `${sku}-${style.id}`,
          );
          const filename = `pop-${this.safeFilename(sku)}-${style.id}-${timestamp}.png`;
          const localPath = path.join(this.uploadsDir, filename);
          fs.writeFileSync(localPath, prepared.buffer);

          variations.push({
            styleId: style.id,
            styleName: style.name,
            imageUrl: `/media/serve/${filename}`,
            filename,
            promptUsed: prompt,
            model: imageResult.model,
            cutoutUsed: prepared.cutoutUsed,
            branded: true,
          });
          this.logger.log(`Branded POP saved: ${filename} (${style.name}, model: ${imageResult.model})`);
        } catch (err) {
          this.logger.error(`Branded POP style ${style.id} failed: ${String(err)}`);
          variations.push({
            styleId: style.id,
            styleName: style.name,
            imageUrl: '',
            filename: '',
            promptUsed: '',
            model: '',
            cutoutUsed: false,
            branded: true,
          });
        }
      }
    }

    return {
      sku,
      productName: product.name,
      copy,
      variations,
      generatedAt: new Date().toISOString(),
      productImageSize,
    };
  }

  private loadSelectedBrandAssets(filenames: string[]): BrandAsset[] {
    const existing = this.listBrandAssets();
    const selected = new Set(filenames.map((f) => path.basename(f)));
    return existing.filter((asset) => selected.has(asset.filename));
  }

  private async buildBrandReferenceSheet(
    sharp: (input?: Buffer | object) => any,
    productImage: Buffer,
    brandAssets: BrandAsset[],
  ): Promise<Buffer> {
    const canvasW = 1024;
    const canvasH = 1024;
    const layers: { input: Buffer; left: number; top: number }[] = [];

    const product = await sharp(productImage)
      .resize(520, 520, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    layers.push({ input: product, left: 40, top: 250 });

    for (const [idx, asset] of brandAssets.slice(0, 6).entries()) {
      const assetBuffer = fs.readFileSync(this.getBrandAssetPath(asset.filename));
      const img = await sharp(assetBuffer)
        .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      layers.push({ input: img, left: 620 + col * 190, top: 150 + row * 210 });
    }

    return sharp({
      create: {
        width: canvasW,
        height: canvasH,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite(layers)
      .png()
      .toBuffer();
  }

  private async generatePopCopy(
    productName: string,
    category: string,
    price: string,
    visualFacts: string,
  ): Promise<PopStickerCopy> {
    const safeWords = MediaService.POP_SAFE_WORDS.join(', ');
    const bannedWords = MediaService.POP_BANNED_WORDS.join(', ');

    const system = [
      'You are a retail marketing copywriter for a Thai souvenir and health supplement store.',
      'Write short, readable POP sticker copy for tourists and walk-in customers.',
      'Rules:',
      `- Use only these safe claim words: ${safeWords}`,
      `- NEVER use: ${bannedWords}`,
      '- Maximum 3 benefits, each ≤6 words',
      '- Headline: ≤8 words, all caps or title case',
      '- Subheadline: ≤8 words',
      '- 2-3 badge labels (e.g. Best Seller, Popular in Thailand, 30 Softgel Capsules)',
      '- Do not use SKU, product code, catalog-card text, ERP labels, or price as marketing copy',
      'Respond with ONLY valid JSON, no markdown, no explanation.',
    ].join('\n');

    const user = [
      `Product: ${productName}`,
      `Category: ${category}`,
      `Price: ฿${price}`,
      `Visual facts: ${visualFacts}`,
      '',
      'Return JSON:',
      '{"headline":"...","subheadline":"...","benefits":["...","...","..."],"badges":["...","..."]}',
    ].join('\n');

    try {
      const res = await this.openAi.complete(system, user);
      const json = JSON.parse(res.content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')) as PopStickerCopy;
      if (json.headline && Array.isArray(json.benefits)) {
        json.benefits = json.benefits.slice(0, 3);
        return json;
      }
    } catch (err) {
      this.logger.warn(`POP copy generation failed, using fallback: ${String(err)}`);
    }

    return {
      headline: productName.toUpperCase().slice(0, 40),
      subheadline: 'Natural Goodness for Daily Wellness',
      benefits: ['Supports Daily Wellness', 'Natural Ingredients', 'Easy to Use'],
      badges: ['Best Seller', 'Popular in Thailand'],
    };
  }

  private cleanPopProductName(name: string, sku: string): string {
    return name
      .replace(new RegExp(`\\b${this.escapeRegExp(sku)}\\b`, 'gi'), ' ')
      .replace(/\bPM\d{4,}\b/gi, ' ')
      .replace(/\([^)]*\)\s*/g, ' ')
      .replace(/\b\d+\s*(ml|g|kg|capsules?|softgels?|pcs?|ชิ้น|กรัม)\b/gi, ' ')
      .replace(/[+#/|]+/g, (m) => (m.includes('+') ? ' + ' : ' '))
      .replace(/\s+/g, ' ')
      .trim();
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Builds a full-image prompt in the same style as the user's ChatGPT screenshots.
   * GPT Image should use the ERP image only as product reference, not as a catalog card.
   */
  private buildPopStickerPrompt(
    productName: string,
    copy: PopStickerCopy,
    visualFacts: string,
    style: { id: string; name: string; mood: string; badge: string },
  ): string {
    const benefits = copy.benefits.slice(0, 3);
    const badges = [...new Set([style.badge, ...copy.badges])].slice(0, 3);
    const commonRules = [
      '',
      'Reference image rules:',
      '- Use the uploaded/reference image only to understand the real product bottle/package appearance.',
      '- Extract the product bottle/package from the reference and place it naturally inside the sticker.',
      '- Do not reproduce the catalog card layout from the reference image.',
      '- Do not display SKU, product code, catalog-card text, ERP label, price, UI text, or surrounding reference-image captions.',
      '- Do not show codes like PM00005, PM00010, or any similar product code anywhere.',
      '',
      'Output requirements:',
      'Die-cut shape requirements:',
      '- Custom shelf-talker silhouette with wavy, rounded, crown-top, banner-bottom, or decorative contour — NOT a full-bleed square poster.',
      '- Add a visible outer edge around the entire sticker: soft drop shadow, gold outline, or contrasting trim separating sticker from canvas.',
      '- Plain uniform light margin must appear ONLY outside that outer edge.',
      '- Keep the full sign background INSIDE the sticker silhouette (white, gold, gradient, or colored panel).',
      '- Product bottle/package large in center, naturally integrated with design.',
      '- Easy to read from 2-3 meters.',
      '- High resolution, print-ready PNG, no watermark.',
      '- Supplement-safe wording only; no cure/treat/prevent disease/medicine claims.',
    ];

    if (style.id === 'style_01') {
      return [
        'Create a premium retail POP-UP sticker for a health supplement.',
        '',
        `Product: ${productName}`,
        '',
        'Design Style:',
        '- Clean Japanese pharmacy style',
        '- White background',
        '- Gold and black color theme',
        '- Large black sesame seeds and rice bran illustrations',
        '- Soft glowing effect',
        '- Premium supplement advertisement',
        '',
        'Main Headline:',
        `BLACK SESAME OIL + RICE BRAN OIL or "${copy.headline}"`,
        '',
        'Benefits:',
        ...benefits.map((b) => `✓ ${b}`),
        '',
        'Badge:',
        `★ ${badges[0] ?? 'Best Seller'}`,
        '',
        'Include:',
        '- Product bottle in center',
        '- Capsule elements around bottle',
        '- Retail promotional layout',
        '- Ingredient visuals around product',
        ...commonRules,
      ].join('\n');
    }

    if (style.id === 'style_02') {
      return [
        'Create a pharmacy shelf POP sticker.',
        '',
        'Main Message:',
        copy.headline.includes('BEAUTY') ? copy.headline : 'NATURAL BEAUTY FROM INSIDE',
        '',
        productName,
        '',
        'Visual Elements:',
        '- Premium supplement bottle',
        '- Black sesame seeds splash',
        '- Golden rice bran oil droplets',
        '- Luxury gold accents',
        '- Modern clean layout',
        '',
        'Benefits:',
        ...benefits.map((b) => `✦ ${b.replace(/^Supports\s+/i, '')}`),
        '',
        'Add:',
        badges.includes('30 Softgel Capsules') ? '"30 Softgels"' : badges.map((b) => `"${b}"`).join(', '),
        '',
        'Style:',
        'Japanese health store',
        'Premium wellness product',
        'Highly attractive for tourists',
        'Die-cut rounded shelf-talker or wavy oval silhouette',
        'Gold border trim and soft drop shadow around the entire outer contour',
        'White/gold panel stays inside the contour only',
        ...commonRules,
      ].join('\n');
    }

    if (style.id === 'style_03') {
      return [
        'Create a retail promotional POP sticker for tourists shopping in Thailand.',
        '',
        'Product:',
        productName,
        '',
        'Design:',
        '- Bright clean background',
        '- Premium pharmacy look',
        '- Product bottle large in center',
        '- Black sesame seeds and golden rice grains around product',
        '- Tourist-friendly design',
        '',
        'Headline:',
        'BEST SELLER',
        copy.headline,
        '',
        'Subheadline:',
        benefits.join(' • '),
        '',
        'Badges:',
        '★ Popular in Thailand',
        '★ Tourist Favorite',
        '',
        'Style:',
        'Modern retail shelf stopper',
        'Easy to notice from 5 meters away',
        'Professional product photography',
        'High resolution',
        ...commonRules,
      ].join('\n');
    }

    return [
      'Create a professional retail shelf talker sticker.',
      '',
      'Theme:',
      'Japanese Drugstore Best Seller',
      '',
      'Headline:',
      copy.headline,
      '',
      'Benefits Icons:',
      'Hair',
      'Skin',
      'Heart',
      'Antioxidant',
      '',
      'Visual:',
      '- Realistic product bottle',
      '- Floating capsules',
      '- Black sesame ingredient splash',
      '- Golden rice bran oil splash',
      '- Clean white background',
      '- Gold premium frame',
      '',
      'Badges:',
      'BEST SELLER',
      'POPULAR IN THAILAND',
      '',
      'Typography:',
      'Large bold headline',
      'Minimal text',
      'Easy to read quickly',
      '',
      'Print-ready',
      'Die-cut sticker style',
      '1:1 ratio',
      ...commonRules,
    ].join('\n');
  }

  private buildBrandedPopStyles(count: number) {
    return [
      {
        id: 'brand_style_01',
        name: '100 Baht Shop Branded POP',
        concept: 'premium product-led retail sticker with small store logo and clean brand strip',
      },
      {
        id: 'brand_style_02',
        name: 'Mascot Tourist Favorite',
        concept: 'friendly tourist shelf sticker with mascot character in a corner',
      },
      {
        id: 'brand_style_03',
        name: 'Brand Shelf Stopper',
        concept: 'bold shelf-stopper style with logo badge and mascot side pose',
      },
      {
        id: 'brand_style_04',
        name: 'Mascot Best Seller Badge',
        concept: 'Japanese drugstore best seller style with mascot and store logo integrated as small badges',
      },
    ].slice(0, count);
  }

  private buildBrandedPopStickerPrompt(
    productName: string,
    copy: PopStickerCopy,
    visualFacts: string,
    style: { id: string; name: string; concept: string },
    brandAssets: BrandAsset[],
  ): string {
    const benefits = copy.benefits.slice(0, 3).join(' • ');
    const logos = brandAssets.filter((a) => a.kind === 'logo').length;
    const mascots = brandAssets.filter((a) => a.kind === 'mascot').length;
    return [
      'Create a premium branded retail POP sticker for store display.',
      '',
      `Style concept: ${style.concept}`,
      `Product: ${productName}`,
      `Product visual facts: ${visualFacts}`,
      `Main headline: ${copy.headline}`,
      `Subheadline: ${copy.subheadline}`,
      `Benefits: ${benefits}`,
      `Badges: ${copy.badges.slice(0, 3).join(', ')}`,
      '',
      'Brand reference instructions:',
      `- The reference sheet contains the product plus ${logos} store logo(s) and ${mascots} mascot image(s).`,
      '- Use the product as the main subject.',
      '- Add store logo as a small brand element: top corner, bottom strip, or small seal.',
      '- Add one selected mascot as a small friendly character on the side or bottom corner.',
      '- Logo and mascot must support the sticker, not dominate or cover the product.',
      '- Keep product-led retail design first; branding is secondary.',
      '',
      'Design requirements:',
      '- Custom die-cut shelf-talker silhouette with visible outer edge (drop shadow, gold trim, or contour).',
      '- Plain light margin only outside the sticker contour; keep full sign background inside.',
      '- White, gold, black, and clean retail pharmacy style.',
      '- Clear English benefit copy readable from 2-3 meters.',
      '- Premium tourist-store retail style suitable for 100 Baht Shop Thailand.',
      '- Do not display SKU, product code, catalog-card text, ERP label, price, UI text, or surrounding reference-image captions.',
      '- Do not show codes like PM00005, PM00010, or any similar product code anywhere.',
      '- No medical claims: do not use cure, treat, prevent disease, medicine, doctor recommended.',
      '- 1:1 ratio, high resolution, print-ready, no watermark.',
    ].join('\n');
  }

  /**
   * Generate promotion poster via pixel-perfect compositing:
   * 1. Optionally call n8n → rembg to get a cutout PNG of the product
   * 2. Use sharp to composite the cutout + text layers onto the template PNG
   */
  async generatePromoComposite(
    promoType: string,
    data: Record<string, string>,
    imageUrls: Record<string, string>,
  ): Promise<PromoCompositeResult> {
    try {
      const webhookUrl = await this.settings.get('n8n_promo_webhook_url');
      const n8nEnabled = webhookUrl?.startsWith('http') ?? false;

      // Fetch and optionally cutout each image
      const imageBuffers: Record<string, Buffer> = {};
      let cutoutUsed = false;

      for (const [slotName, imgUrl] of Object.entries(imageUrls)) {
        if (!imgUrl) continue;
        try {
          const { buffer } = await this.proxyImage(imgUrl);
          if (n8nEnabled) {
            try {
              const cutout = await this.callN8nCutout(webhookUrl!, imgUrl, slotName);
              imageBuffers[slotName] = cutout;
              cutoutUsed = true;
              this.logger.log(`Cutout via n8n: ${slotName}`);
            } catch (err) {
              this.logger.warn(`n8n cutout failed for ${slotName}, using original: ${String(err)}`);
              imageBuffers[slotName] = buffer;
            }
          } else {
            imageBuffers[slotName] = buffer;
          }
        } catch (err) {
          this.logger.warn(`Could not fetch image for slot ${slotName}: ${String(err)}`);
        }
      }

      const resultBuffer = await this.composite.composite(promoType, data, imageBuffers);

      const safeType = promoType.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `promo-composite-${safeType}-${Date.now()}.png`;
      const localPath = path.join(this.uploadsDir, filename);
      fs.writeFileSync(localPath, resultBuffer);

      this.logger.log(`Composite saved: ${filename} (cutout: ${cutoutUsed})`);

      return {
        imageUrl: `/media/serve/${filename}`,
        filename,
        generatedAt: new Date().toISOString(),
        source: 'composite',
        cutoutUsed,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Promo composite failed: ${msg}`);
      throw new BadRequestException(msg || 'สร้างโปสเตอร์ไม่สำเร็จ');
    }
  }

  private async prepareTransparentPopSticker(
    sharp: (input?: Buffer | object) => any,
    input: Buffer,
    _label: string,
  ): Promise<{ buffer: Buffer; cutoutUsed: boolean }> {
    const buffer = await this.applyDieCutTransparency(sharp, input);
    return { buffer, cutoutUsed: false };
  }

  private centerRegionMeanAlpha(data: Buffer, width: number, height: number): number {
    const x0 = Math.floor(width * 0.25);
    const x1 = Math.ceil(width * 0.75);
    const y0 = Math.floor(height * 0.25);
    const y1 = Math.ceil(height * 0.75);
    let sum = 0;
    let count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        sum += data[((y * width) + x) * 4 + 3];
        count++;
      }
    }
    return count > 0 ? sum / count : 255;
  }

  private floodFillOuterBackground(
    data: Buffer,
    width: number,
    height: number,
    bg: [number, number, number],
    tolerance: number,
  ): Buffer {
    const out = Buffer.from(data);
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];
    const pixelIndex = (x: number, y: number) => ((y * width) + x) * 4;
    const cellIndex = (x: number, y: number) => (y * width) + x;

    const enqueue = (x: number, y: number) => {
      const cell = cellIndex(x, y);
      if (visited[cell]) return;
      if (!this.pixelMatchesBg(out, width, x, y, bg, tolerance)) return;
      visited[cell] = 1;
      queue.push(cell);
    };

    for (let x = 0; x < width; x++) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }

    while (queue.length > 0) {
      const cell = queue.pop()!;
      const x = cell % width;
      const y = Math.floor(cell / width);
      out[pixelIndex(x, y) + 3] = 0;
      if (x > 0) enqueue(x - 1, y);
      if (x < width - 1) enqueue(x + 1, y);
      if (y > 0) enqueue(x, y - 1);
      if (y < height - 1) enqueue(x, y + 1);
    }

    return out;
  }

  private async applyDieCutTransparency(
    sharp: (input?: Buffer | object) => any,
    input: Buffer,
    tolerance = 20,
    uniformLineThreshold = 0.9,
  ): Promise<Buffer> {
    const { data, info } = await sharp(input)
      .flatten({ background: '#ffffff' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const width = info.width;
    const height = info.height;
    const bg = this.averageCornerRgb(data, width, height);
    const centerBefore = this.centerRegionMeanAlpha(data, width, height);

    const rowBgRatio = (y: number) => {
      let match = 0;
      for (let x = 0; x < width; x++) {
        if (this.pixelMatchesBg(data, width, x, y, bg, tolerance)) match++;
      }
      return match / width;
    };
    const colBgRatio = (x: number) => {
      let match = 0;
      for (let y = 0; y < height; y++) {
        if (this.pixelMatchesBg(data, width, x, y, bg, tolerance)) match++;
      }
      return match / height;
    };

    let top = 0;
    while (top < height && rowBgRatio(top) >= uniformLineThreshold) top++;
    let bottom = height - 1;
    while (bottom > top && rowBgRatio(bottom) >= uniformLineThreshold) bottom--;
    let left = 0;
    while (left < width && colBgRatio(left) >= uniformLineThreshold) left++;
    let right = width - 1;
    while (right > left && colBgRatio(right) >= uniformLineThreshold) right--;

    const pixelIndex = (x: number, y: number) => ((y * width) + x) * 4;
    let working = Buffer.from(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const inOuterMargin = y < top || y > bottom || x < left || x > right;
        if (inOuterMargin && this.pixelMatchesBg(working, width, x, y, bg, tolerance)) {
          working[pixelIndex(x, y) + 3] = 0;
        }
      }
    }

    const flooded = this.floodFillOuterBackground(working, width, height, bg, tolerance);
    const centerAfter = this.centerRegionMeanAlpha(flooded, width, height);
    if (centerAfter >= centerBefore * 0.88) {
      working = flooded;
    }

    return (sharp as (input: Buffer, options?: { raw: { width: number; height: number; channels: number } }) => ReturnType<typeof sharp>)(
      working,
      { raw: { width, height, channels: 4 } },
    )
      .png()
      .trim({ threshold: 8 })
      .toBuffer();
  }

  private averageCornerRgb(data: Buffer, width: number, height: number): [number, number, number] {
    const corners = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ];
    let r = 0;
    let g = 0;
    let b = 0;
    for (const [x, y] of corners) {
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return [Math.round(r / 4), Math.round(g / 4), Math.round(b / 4)];
  }

  private pixelMatchesBg(
    data: Buffer,
    width: number,
    x: number,
    y: number,
    bg: [number, number, number],
    tolerance: number,
  ): boolean {
    const i = (y * width + x) * 4;
    return Math.abs(data[i] - bg[0]) <= tolerance
      && Math.abs(data[i + 1] - bg[1]) <= tolerance
      && Math.abs(data[i + 2] - bg[2]) <= tolerance;
  }

  private async removeUniformOuterMargins(
    sharp: (input?: Buffer | object) => any,
    input: Buffer,
  ): Promise<Buffer> {
    return this.applyDieCutTransparency(sharp, input);
  }

  private async callN8nCutout(webhookUrl: string, imageUrl: string, sku: string): Promise<Buffer> {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productImageUrl: imageUrl, sku }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`n8n returned HTTP ${res.status}`);
    }
    const json = (await res.json()) as { cutoutBase64?: string };
    if (!json.cutoutBase64) throw new Error('n8n response missing cutoutBase64');
    return Buffer.from(json.cutoutBase64, 'base64');
  }

  /** Generate promotion poster via template PNG + AI prompt + GPT Image edit */
  async generatePromoGptImage(
    promoType: string,
    data: Record<string, unknown>,
    referenceImageUrl?: string,
  ): Promise<PromoGptResult> {
    try {
      const label = PROMO_TYPE_LABELS[promoType] ?? promoType;
      this.logger.log(`GPT Image promo generating: ${promoType} (template reference)…`);

      let imagePrompt = await this.craftPromoImagePrompt(promoType, label, data, referenceImageUrl);
      if (imagePrompt.length > 3500) {
        imagePrompt = imagePrompt.slice(0, 3500);
      }

      let imageResult;
      try {
        const templateBuffer = this.loadPromoTemplate(promoType);
        imageResult = await this.openAi.editGptImage(imagePrompt, templateBuffer, 'image/png', {
          size: '1536x1024',
        });
      } catch (err) {
        this.logger.warn(`Promo template edit failed, falling back to generate: ${String(err)}`);
        imageResult = await this.openAi.generateGptImage(imagePrompt, { size: '1536x1024' });
      }

      const safeType = promoType.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `promo-gpt-${safeType}-${Date.now()}.png`;
      const localPath = path.join(this.uploadsDir, filename);
      fs.writeFileSync(localPath, imageResult.buffer);

      this.logger.log(`Promo GPT Image saved ${filename} (model: ${imageResult.model})`);

      return {
        imageUrl: `/media/serve/${filename}`,
        filename,
        model: imageResult.model,
        promptUsed: imagePrompt,
        generatedAt: new Date().toISOString(),
        source: 'gpt_image',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Promo GPT Image failed: ${msg}`);
      throw new BadRequestException(msg || 'สร้างโปสเตอร์ไม่สำเร็จ');
    }
  }

  /** Load official promo template PNG from backend assets */
  private loadPromoTemplate(promoType: string): Buffer {
    const filename = PROMO_TEMPLATE_FILES[promoType];
    if (!filename) throw new Error(`Unknown promo type: ${promoType}`);

    const candidates = [
      path.join(process.cwd(), 'assets', 'promo-templates', filename),
      path.join(process.cwd(), 'dist', 'promo-templates', filename),
      path.join(process.cwd(), 'dist', 'assets', 'promo-templates', filename),
      path.join(__dirname, '..', '..', 'promo-templates', filename),
      path.join(__dirname, '..', '..', 'assets', 'promo-templates', filename),
      path.join(process.cwd(), '..', 'frontend', 'public', 'templates', filename),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.logger.log(`Using promo template: ${p}`);
        return fs.readFileSync(p);
      }
    }
    throw new Error(
      `ไม่พบไฟล์ Template PNG สำหรับ ${promoType} — รัน npm run build ใน backend หรือตรวจสอบ assets/promo-templates/`,
    );
  }

  /** AI writes the GPT Image edit prompt — fills placeholders on the template PNG */
  private async craftPromoImagePrompt(
    promoType: string,
    promoLabel: string,
    data: Record<string, unknown>,
    referenceImageUrl?: string,
  ): Promise<string> {
    const layoutHint = PROMO_TEMPLATE_LAYOUTS[promoType] ?? '';
    const dataJson = JSON.stringify(data, null, 2);

    let productVisualHint = '';
    if (referenceImageUrl?.startsWith('http')) {
      try {
        const { buffer, contentType } = await this.proxyImage(referenceImageUrl);
        const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
        productVisualHint = await this.openAi.analyzeImage(
          dataUrl,
          'Describe this product packaging briefly (color, shape, label text) for reproducing it accurately in a marketing poster product photo area. Max 3 sentences in English.',
        );
      } catch (err) {
        this.logger.warn(`Product vision analysis skipped: ${String(err)}`);
        productVisualHint = 'Use the product name from the form data to render an accurate product photo.';
      }
    }

    const system = [
      'You are an expert prompt engineer for GPT Image EDIT mode.',
      'The input image is an OFFICIAL "100 Baht Shop Thailand" promotion poster TEMPLATE with placeholder labels.',
      'Your prompt must instruct GPT Image to:',
      '1. KEEP the exact template layout, colors, branding, logo, elephant mascot, and decorative elements',
      '2. REPLACE all placeholder text ([PRICE], [FREE_GIFT], [PRODUCT_IMAGE], etc.) with REAL data values',
      '3. REMOVE placeholder brackets and camera icons — show real product photos and readable Thai text',
      '4. Use the exact Thai text values provided in the form data',
      'Output ONLY the image edit prompt in English (max 600 words).',
    ].join('\n');

    const user = [
      `Promotion type: ${promoLabel}`,
      '',
      layoutHint,
      '',
      'Form data — use these EXACT values on the poster:',
      dataJson,
      '',
      referenceImageUrl
        ? `Product photo reference (render this product accurately in the product placeholder):\n${productVisualHint}`
        : 'No product photo reference — render appropriate product imagery based on product names in the data.',
      '',
      'Write the GPT Image EDIT prompt to fill this template with the promotion data.',
    ].join('\n');

    try {
      const res = await this.openAi.complete(system, user);
      const prompt = res.content.trim();
      if (prompt.length > 80) return prompt;
    } catch (err) {
      this.logger.warn(`AI prompt craft failed, using fallback: ${String(err)}`);
    }

    return this.buildFallbackPromoPrompt(promoType, promoLabel, data, layoutHint);
  }

  private buildFallbackPromoPrompt(
    promoType: string,
    promoLabel: string,
    data: Record<string, unknown>,
    layoutHint: string,
  ): string {
    return [
      'Edit this promotion poster template image for 100 Baht Shop Thailand.',
      `Promotion type: ${promoLabel}`,
      '',
      layoutHint,
      '',
      'Replace ALL placeholder labels with real content. Remove [BRACKETS] and placeholder icons.',
      'Use these exact values:',
      JSON.stringify(data),
      '',
      'Keep template layout, red/white branding, elephant mascot unchanged.',
      'All promotional text in Thai. Print-ready quality.',
    ].join('\n');
  }

  /** Save a client-rendered promotion poster PNG */
  async savePromoImage(
    promoType: string,
    dataUrl: string,
  ): Promise<{ imageUrl: string; filename: string }> {
    const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!match) throw new BadRequestException('Invalid image data');

    const safeType = promoType.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `promo-${safeType}-${Date.now()}.png`;
    const localPath = path.join(this.uploadsDir, filename);

    try {
      fs.writeFileSync(localPath, Buffer.from(match[1], 'base64'));
    } catch (err) {
      this.logger.error(`Failed to save promo image: ${String(err)}`);
      throw new BadRequestException('Cannot write image file — check server uploads directory permissions');
    }

    return { imageUrl: `/media/serve/${filename}`, filename };
  }

  /** Generate 3 short Thai feature lines for a product (used by New Arrival template) */
  async generatePromoFeatures(sku: string): Promise<{ feature1: string; feature2: string; feature3: string }> {
    const product = await this.productRepo.findOneBy({ sku });
    if (!product) throw new Error(`ไม่พบสินค้า SKU "${sku}" ใน cache — ซิงค์ ERP ก่อน`);

    const benefits = await this.generateBenefits(product);
    const lines = this.parseBenefitLines(benefits);

    return {
      feature1: lines[0] ?? 'สินค้าใหม่',
      feature2: lines[1] ?? 'คุณภาพดี',
      feature3: lines[2] ?? 'ราคาคุ้มค่า',
    };
  }

  private safeFilename(sku: string): string {
    return sku.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
