import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpProductCache } from '../../database/entities/erp-product-cache.entity';
import { OpenAiService } from '../ai/openai.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

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

  constructor(
    @InjectRepository(ErpProductCache)
    private readonly productRepo: Repository<ErpProductCache>,
    private readonly openAi: OpenAiService,
    private readonly settings: SystemSettingsService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'media');
    fs.mkdirSync(this.uploadsDir, { recursive: true });
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
      .filter((f) => f.endsWith('.png') || f.endsWith('.mp4'))
      .map((filename) => {
        const stat = fs.statSync(path.join(this.uploadsDir, filename));
        return {
          filename,
          url: `/media/serve/${filename}`,
          createdAt: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  /** Generate promotion poster via template PNG + AI prompt + GPT Image edit */
  async generatePromoGptImage(
    promoType: string,
    data: Record<string, unknown>,
    referenceImageUrl?: string,
  ): Promise<PromoGptResult> {
    const label = PROMO_TYPE_LABELS[promoType] ?? promoType;
    this.logger.log(`GPT Image promo generating: ${promoType} (template reference)…`);

    const hasProductRef = !!referenceImageUrl?.startsWith('http');
    const imagePrompt = await this.craftPromoImagePrompt(promoType, label, data, referenceImageUrl);

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
  }

  /** Load official promo template PNG from backend assets */
  private loadPromoTemplate(promoType: string): Buffer {
    const filename = PROMO_TEMPLATE_FILES[promoType];
    if (!filename) throw new Error(`Unknown promo type: ${promoType}`);

    const candidates = [
      path.join(process.cwd(), 'assets', 'promo-templates', filename),
      path.join(process.cwd(), '..', 'frontend', 'public', 'templates', filename),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.logger.log(`Using promo template: ${p}`);
        return fs.readFileSync(p);
      }
    }
    throw new Error(`Template PNG not found for ${promoType} — check assets/promo-templates/`);
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
        productVisualHint = await this.openAi.analyzeImage(
          referenceImageUrl,
          'Describe this product packaging briefly (color, shape, label text) for reproducing it accurately in a marketing poster product photo area. Max 3 sentences in English.',
        );
      } catch {
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
