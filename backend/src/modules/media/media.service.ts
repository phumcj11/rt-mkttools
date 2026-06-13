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
}

export interface PopStickerResult {
  sku: string;
  productName: string;
  copy: PopStickerCopy;
  variations: PopStickerVariation[];
  generatedAt: string;
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
    private readonly composite: PromoCompositeService,
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
   * Full AI POP Sticker workflow:
   * 1. Analyze ERP product image → get product visual facts
   * 2. GPT generates claim-safe retail copy (headline, 3 benefits, badges)
   * 3. Generate 4 × 1:1 GPT Image variations using product image as reference
   * 4. Save all 4 PNGs to uploads/media
   */
  async generatePopStickers(sku: string): Promise<PopStickerResult> {
    const product = await this.productRepo.findOneBy({ sku });
    if (!product) throw new BadRequestException(`ไม่พบสินค้า SKU "${sku}" ใน cache — ซิงค์ ERP ก่อน`);

    this.logger.log(`POP Sticker generating for SKU: ${sku}`);

    // Step 1: analyze product image for visual facts
    let visualFacts = `Product: ${product.name}. Category: ${product.category}. Price: ฿${product.retailPrice}.`;
    let productImageBuffer: Buffer | null = null;
    let productImageMime = 'image/jpeg';

    if (product.imageUrl) {
      try {
        const { buffer, contentType } = await this.proxyImage(product.imageUrl);
        productImageBuffer = buffer;
        productImageMime = contentType;
        const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
        const analysis = await this.openAi.analyzeImage(
          dataUrl,
          'Describe this product packaging in 3-4 sentences: main ingredient visuals, package color, shape, and any key text on the label. Be specific — e.g. "white bottle, black sesame seeds visible on label, gold cap". Used for retail POP sticker design.',
        );
        if (analysis) visualFacts = analysis;
      } catch (err) {
        this.logger.warn(`POP: product image fetch/analysis failed: ${String(err)}`);
      }
    }

    // Step 2: generate safe retail copy
    const copy = await this.generatePopCopy(product.name, product.category, product.retailPrice, visualFacts);

    // Step 3 & 4: generate 4 images, save each
    const timestamp = Date.now();
    const variations: PopStickerVariation[] = [];

    for (const style of MediaService.POP_STYLES) {
      try {
        const prompt = this.buildPopImagePrompt(product.name, copy, visualFacts, style);
        let imageResult;

        if (productImageBuffer) {
          try {
            imageResult = await this.openAi.editGptImage(prompt, productImageBuffer, productImageMime, { size: '1024x1024' });
          } catch (editErr) {
            this.logger.warn(`POP edit failed for ${style.id}, falling back to generate: ${String(editErr)}`);
            imageResult = await this.openAi.generateGptImage(prompt, { size: '1024x1024' });
          }
        } else {
          imageResult = await this.openAi.generateGptImage(prompt, { size: '1024x1024' });
        }

        const filename = `pop-${this.safeFilename(sku)}-${style.id}-${timestamp}.png`;
        const localPath = path.join(this.uploadsDir, filename);
        fs.writeFileSync(localPath, imageResult.buffer);

        variations.push({
          styleId: style.id,
          styleName: style.name,
          imageUrl: `/media/serve/${filename}`,
          filename,
          promptUsed: prompt,
          model: imageResult.model,
        });
        this.logger.log(`POP saved: ${filename} (${style.name})`);
      } catch (err) {
        this.logger.error(`POP style ${style.id} failed: ${String(err)}`);
        variations.push({
          styleId: style.id,
          styleName: style.name,
          imageUrl: '',
          filename: '',
          promptUsed: '',
          model: '',
        });
      }
    }

    return {
      sku,
      productName: product.name,
      copy,
      variations,
      generatedAt: new Date().toISOString(),
    };
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

  private buildPopImagePrompt(
    productName: string,
    copy: PopStickerCopy,
    visualFacts: string,
    style: { id: string; name: string; mood: string; badge: string },
  ): string {
    const benefits = copy.benefits.slice(0, 3).map((b) => `• ${b}`).join(', ');
    return [
      `Create a premium retail shelf POP sticker (1:1 square format, print-ready, high resolution).`,
      `Product: ${productName}`,
      `Style: ${style.mood}`,
      `Product visual reference: ${visualFacts}`,
      `Headline: ${copy.headline}`,
      `Subheadline: ${copy.subheadline}`,
      `Benefits: ${benefits}`,
      `Badge: ${style.badge}`,
      `Design rules:`,
      `- Product bottle/package must be large, centered, and clearly visible`,
      `- Maximum 3 benefit text lines, short and readable from 3 meters`,
      `- Bold headline at the top`,
      `- Ingredient visuals (seeds, capsules, drops) as decorative accents`,
      `- No medical claims, no disease treatment wording`,
      `- Professional retail shelf sticker, suitable for tourist souvenir stores in Thailand`,
      `- 1:1 ratio, high resolution, no watermark, print-ready`,
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
