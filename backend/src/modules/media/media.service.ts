import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
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
  originalImageUrl: string;
  generatedAt: string;
  source: 'dalle' | 'erp_composite';
}

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

  async generateBenefitImage(sku: string): Promise<ProductMediaResult> {
    const product = await this.productRepo.findOneBy({ sku });
    if (!product) throw new Error(`ไม่พบสินค้า SKU "${sku}" ใน cache — ซิงค์ ERP ก่อน`);

    const benefits = await this.generateBenefits(product);
    const filename = `product-${this.safeFilename(sku)}-${Date.now()}.png`;
    const localPath = path.join(this.uploadsDir, filename);
    const servedUrl = `/media/serve/${filename}`;

    // Try DALL-E 3 first
    try {
      const dallePrompt = this.buildDallePrompt(product);
      const { url: dalleUrl } = await this.openAi.generateImage(dallePrompt, { size: '1024x1024' });
      await this.downloadFile(dalleUrl, localPath);
      return {
        sku,
        productName: product.name,
        imageUrl: servedUrl,
        benefits,
        originalImageUrl: product.imageUrl,
        generatedAt: new Date().toISOString(),
        source: 'dalle',
      };
    } catch (dalleErr: unknown) {
      const dalleMsg = dalleErr instanceof Error ? dalleErr.message : String(dalleErr);
      this.logger.warn(`DALL-E failed for ${sku}, using ERP fallback: ${dalleMsg}`);

      if (!product.imageUrl) {
        throw new Error(
          dalleMsg.includes('OpenAI API Key')
            ? dalleMsg
            : `สร้างรูปไม่สำเร็จ: ${dalleMsg} (สินค้านี้ไม่มีรูป ERP สำหรับ fallback)`,
        );
      }

      await this.createErpCompositeImage(product, localPath);
      return {
        sku,
        productName: product.name,
        imageUrl: servedUrl,
        benefits,
        originalImageUrl: product.imageUrl,
        generatedAt: new Date().toISOString(),
        source: 'erp_composite',
      };
    }
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

  private async generateBenefits(product: ErpProductCache): Promise<string> {
    try {
      if (product.imageUrl) {
        return await this.openAi.analyzeImage(
          product.imageUrl,
          `ดูรูปสินค้าชิ้นนี้และสรุปสรรพคุณ/จุดเด่น 5 ข้อ เป็นภาษาไทย สำหรับสินค้า: ${product.name} หมวด: ${product.category} ราคา ฿${product.retailPrice}`,
        );
      }
      const res = await this.openAi.complete(
        'คุณเป็นนักเขียน copy การตลาดสินค้าปลีก ตอบเป็นภาษาไทย',
        `เขียนสรรพคุณ/จุดเด่น 5 ข้อของสินค้า: ${product.name} หมวด: ${product.category} ราคา ฿${product.retailPrice}`,
      );
      return res.content;
    } catch (err) {
      this.logger.warn(`Benefits text generation failed: ${String(err)}`);
      return `สินค้า: ${product.name}\nราคา: ฿${product.retailPrice}\nหมวด: ${product.category}`;
    }
  }

  /** Sanitized prompt — avoid medical claims that trigger content policy */
  private buildDallePrompt(product: ErpProductCache): string {
    const category = product.category || 'retail product';
    const price = product.retailPrice || '0';
    return [
      'Professional retail store marketing poster layout.',
      `Product category: ${category}.`,
      `Price badge: ${price} Baht.`,
      'Clean white background, modern minimalist design.',
      'Generic product package photography style, no medical claims, no brand logos, no readable text.',
      'Studio lighting, high quality commercial photo.',
    ].join(' ');
  }

  /** Fallback: composite ERP product photo + price header using sharp */
  private async createErpCompositeImage(product: ErpProductCache, dest: string): Promise<void> {
    const sharp = (await import('sharp')).default;
    const width = 1024;
    const height = 1024;

    const imgRes = await fetch(product.imageUrl);
    if (!imgRes.ok) throw new Error(`ดาวน์โหลดรูป ERP ไม่สำเร็จ (${imgRes.status})`);

    const imgBuf = Buffer.from(await imgRes.arrayBuffer());
    const productImg = await sharp(imgBuf)
      .resize(880, 780, { fit: 'inside', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    const meta = await sharp(productImg).metadata();
    const pw = meta.width ?? 880;
    const ph = meta.height ?? 780;
    const left = Math.floor((width - pw) / 2);
    const top = 120;

    const price = Number(product.retailPrice).toLocaleString('th-TH');
    const headerSvg = Buffer.from(`
      <svg width="${width}" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#dc2626"/>
        <text x="50%" y="55%" font-size="42" fill="white" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold">
          ${price} Baht
        </text>
      </svg>
    `);

    const footerSvg = Buffer.from(`
      <svg width="${width}" height="60" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1e40af"/>
        <text x="50%" y="55%" font-size="22" fill="white" text-anchor="middle" font-family="Arial,sans-serif">
          100 Baht Shop Thailand
        </text>
      </svg>
    `);

    await sharp({
      create: { width, height, channels: 4, background: { r: 248, g: 250, b: 252, alpha: 1 } },
    })
      .composite([
        { input: headerSvg, top: 0, left: 0 },
        { input: productImg, top, left },
        { input: footerSvg, top: height - 60, left: 0 },
      ])
      .png()
      .toFile(dest);
  }

  private safeFilename(sku: string): string {
    return sku.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private async downloadFile(url: string, dest: string, redirects = 0): Promise<void> {
    if (redirects > 5) throw new Error('Too many redirects downloading image');

    const res = await fetch(url, { redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('Redirect without location');
      return this.downloadFile(loc, dest, redirects + 1);
    }
    if (!res.ok) throw new Error(`Download failed HTTP ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) throw new Error('Downloaded file too small — likely not a valid image');
    fs.writeFileSync(dest, buf);
  }
}
