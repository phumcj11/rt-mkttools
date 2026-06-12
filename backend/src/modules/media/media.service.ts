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
  imageUrl: string;       // local served URL
  benefits: string;       // AI generated text
  originalImageUrl: string;
  generatedAt: string;
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

  /** List cached products (with imageUrl) */
  async listProducts(limit = 50, offset = 0) {
    return this.productRepo.find({
      order: { syncedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Generate a product benefit image via DALL-E 3.
   * Uses GPT-4o Vision first (if product has imageUrl) to extract context,
   * then DALL-E 3 to create the marketing image.
   */
  async generateBenefitImage(sku: string): Promise<ProductMediaResult> {
    const product = await this.productRepo.findOneBy({ sku });
    if (!product) throw new Error(`Product SKU "${sku}" not found in cache`);

    // Step 1: Generate Thai benefit copy with GPT-4o
    let benefits: string;
    try {
      if (product.imageUrl) {
        benefits = await this.openAi.analyzeImage(
          product.imageUrl,
          `ดูรูปสินค้าชิ้นนี้และสรุปสรรพคุณ/จุดเด่น 5 ข้อ เป็นภาษาไทย สำหรับสินค้า: ${product.name} หมวด: ${product.category} ราคา ฿${product.retailPrice}`,
        );
      } else {
        const res = await this.openAi.complete(
          'คุณเป็นนักเขียน copy การตลาดสินค้าปลีก ตอบเป็นภาษาไทย',
          `เขียนสรรพคุณ/จุดเด่น 5 ข้อของสินค้า: ${product.name} หมวด: ${product.category} ราคา ฿${product.retailPrice}`,
        );
        benefits = res.content;
      }
    } catch (err) {
      this.logger.warn(`GPT-4o analysis failed for ${sku}: ${String(err)}`);
      benefits = `สินค้า: ${product.name}\nราคา: ฿${product.retailPrice}\nหมวด: ${product.category}`;
    }

    // Step 2: Generate marketing image with DALL-E 3
    const dallePrompt = [
      `Create a Thai retail product marketing infographic for: ${product.name}`,
      `Category: ${product.category}`,
      `Price: ${product.retailPrice} Baht`,
      'Style: Clean modern infographic, white background, Thai retail aesthetic.',
      'Include visual elements that highlight product benefits.',
      'Text should be minimal English only (no Thai text in image).',
      'Professional photography studio quality.',
    ].join(' ');

    const { url: dalleUrl } = await this.openAi.generateImage(dallePrompt, { size: '1024x1024' });

    // Step 3: Download + save locally
    const filename = `product-${sku}-${Date.now()}.png`;
    const localPath = path.join(this.uploadsDir, filename);
    await this.downloadFile(dalleUrl, localPath);

    const servedUrl = `/uploads/media/${filename}`;
    return {
      sku,
      productName: product.name,
      imageUrl: servedUrl,
      benefits,
      originalImageUrl: product.imageUrl,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Batch generate benefit images for multiple SKUs.
   * Returns results one by one; errors per SKU are caught and returned as partial results.
   */
  async batchGenerateBenefitImages(skus: string[]): Promise<{
    success: ProductMediaResult[];
    failed: { sku: string; error: string }[];
  }> {
    const success: ProductMediaResult[] = [];
    const failed: { sku: string; error: string }[] = [];
    for (const sku of skus) {
      try {
        const result = await this.generateBenefitImage(sku);
        success.push(result);
      } catch (err: unknown) {
        failed.push({ sku, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { success, failed };
  }

  /** List locally generated media files */
  listGeneratedFiles(): { filename: string; url: string; createdAt: string }[] {
    if (!fs.existsSync(this.uploadsDir)) return [];
    return fs
      .readdirSync(this.uploadsDir)
      .filter((f) => f.endsWith('.png') || f.endsWith('.mp4'))
      .map((filename) => {
        const stat = fs.statSync(path.join(this.uploadsDir, filename));
        return {
          filename,
          url: `/uploads/media/${filename}`,
          createdAt: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Get Google Drive folder ID from settings */
  async getDriveFolderId(): Promise<string | null> {
    return this.settings.get('google_drive_folder_id');
  }

  private async downloadFile(url: string, dest: string): Promise<void> {
    const https = await import('https');
    const http = await import('http');
    const fileStream = fs.createWriteStream(dest);
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      (client as typeof https).get(url, (res) => {
        res.pipe(fileStream);
        fileStream.on('finish', () => { fileStream.close(); resolve(); });
        fileStream.on('error', reject);
      }).on('error', reject);
    });
  }
}
