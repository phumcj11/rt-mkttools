import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { OpenAiService } from '../ai/openai.service';
import { ErpProductCache } from '../../database/entities/erp-product-cache.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getApiBaseUrl } from '../../common/utils/app-urls';
import { GeminiVideoProvider } from './providers/gemini-video.provider';
import { KlingVideoProvider } from './providers/kling-video.provider';
import {
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_PROVIDER,
  PreparedVideoAssets,
  VideoGenerationResult,
  VideoPollOptions,
  VideoProvider,
  VideoProviderId,
  VideoReferenceImage,
  VideoSubmitOptions,
  VIDEO_PROVIDER_MODELS,
} from './video.types';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly uploadsDir: string;
  private readonly brandAssetsDir: string;

  constructor(
    @InjectRepository(ErpProductCache)
    private readonly productRepo: Repository<ErpProductCache>,
    private readonly openAi: OpenAiService,
    private readonly settings: SystemSettingsService,
    private readonly gemini: GeminiVideoProvider,
    private readonly kling: KlingVideoProvider,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'media');
    this.brandAssetsDir = path.join(this.uploadsDir, 'brand-assets');
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    fs.mkdirSync(this.brandAssetsDir, { recursive: true });
  }

  async isConfigured(provider?: VideoProviderId): Promise<boolean> {
    return this.getProvider(provider ?? await this.resolveProvider()).isConfigured();
  }

  async submitProductVideo(sku: string, options: VideoSubmitOptions = {}): Promise<VideoGenerationResult> {
    const product = await this.productRepo.findOneBy({ sku });
    if (!product) throw new Error(`Product SKU "${sku}" not found`);

    const providerId = options.provider ?? await this.resolveProvider();
    const provider = this.getProvider(providerId);
    const model = options.model || await this.resolveModel(providerId);
    if (!(await provider.isConfigured())) throw new Error(`${this.providerLabel(providerId)} API Key ยังไม่ได้ตั้งค่า`);

    const assets = await this.prepareAssets(product, options);
    return provider.submit(assets, { model });
  }

  async pollVideoTask(taskId: string, options: VideoPollOptions = {}): Promise<VideoGenerationResult> {
    const providerId = options.provider ?? await this.resolveProvider();
    return this.getProvider(providerId).poll(taskId, {
      ...options,
      provider: providerId,
      model: options.model || await this.resolveModel(providerId),
    });
  }

  /**
   * Submit + poll until done (max 5 minutes).
   * Downloads and saves video locally when complete.
   */
  async generateAndWait(sku: string, options: VideoSubmitOptions = {}): Promise<VideoGenerationResult> {
    const submitted = await this.submitProductVideo(sku, options);
    const { taskId } = submitted;

    this.logger.log(`Video task submitted: ${taskId} for SKU ${sku}`);

    // Poll every 10s for up to 5 minutes
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await sleep((submitted.pollAfterSeconds ?? 10) * 1_000);
      const status = await this.pollVideoTask(taskId, {
        provider: submitted.provider,
        model: submitted.model,
        metadata: submitted.metadata,
      });

      if (status.status === 'done' && status.videoUrl) {
        // Download video
        const filename = `video-${sku}-${Date.now()}.mp4`;
        const localPath = path.join(this.uploadsDir, filename);
        try {
          await this.downloadFile(status.videoUrl, localPath);
          return {
            ...status,
            localPath: `/media/serve/${filename}`,
          };
        } catch (dlErr) {
          this.logger.warn(`Video download failed: ${String(dlErr)}`);
          return status;
        }
      }

      if (status.status === 'failed') return status;
    }

    return { taskId, provider: submitted.provider, model: submitted.model, status: 'failed', error: 'Timeout waiting for video', metadata: submitted.metadata };
  }

  private async downloadFile(url: string, dest: string): Promise<void> {
    if (url.startsWith('data:video/')) {
      const base64 = url.split(',')[1];
      fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
      return;
    }
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

  private getProvider(id: VideoProviderId): VideoProvider {
    if (id === 'gemini') return this.gemini;
    if (id === 'kling') return this.kling;
    throw new Error('Grok video provider ยังไม่พร้อมใช้งาน');
  }

  private async resolveProvider(): Promise<VideoProviderId> {
    const configured = (await this.settings.get('video_provider_default')) as VideoProviderId | null;
    if (configured && configured in VIDEO_PROVIDER_MODELS) return configured;
    return DEFAULT_VIDEO_PROVIDER;
  }

  private async resolveModel(provider: VideoProviderId): Promise<string> {
    const model = await this.settings.get('video_model_default');
    const models = VIDEO_PROVIDER_MODELS[provider] ?? [];
    if (model && models.includes(model)) return model;
    return provider === DEFAULT_VIDEO_PROVIDER ? DEFAULT_VIDEO_MODEL : models[0];
  }

  private providerLabel(provider: VideoProviderId): string {
    return provider === 'gemini' ? 'Gemini' : provider === 'kling' ? 'Kling' : 'Grok';
  }

  private async prepareAssets(product: ErpProductCache, options: VideoSubmitOptions): Promise<PreparedVideoAssets> {
    const script = (options.script || await this.generateScript(product)).trim();
    const visualBrief = (options.visualBrief || this.defaultVisualBrief()).trim();
    const referenceImages: VideoReferenceImage[] = [];
    let primaryImageUrl = product.imageUrl || undefined;
    let cutoutUsed = false;

    for (const filename of options.mascotAssetFilenames ?? []) {
      const asset = await this.loadBrandAsset(filename);
      if (asset) referenceImages.push(asset);
    }

    if (product.imageUrl) {
      const original = await this.fetchImage(product.imageUrl, 'product original');
      if (original) referenceImages.push(original);
      if (options.useCutoutProductImage) {
        const cutout = await this.cutoutProductImage(product.imageUrl, product.sku).catch((err) => {
          this.logger.warn(`Video cutout failed for ${product.sku}: ${String(err)}`);
          return null;
        });
        if (cutout) {
          const filename = `video-cutout-${this.safeFilename(product.sku)}-${Date.now()}.png`;
          fs.writeFileSync(path.join(this.uploadsDir, filename), cutout);
          primaryImageUrl = `${getApiBaseUrl()}/media/serve/${filename}`;
          referenceImages.push({ label: 'product cutout', buffer: cutout, mimeType: 'image/png', url: primaryImageUrl });
          cutoutUsed = true;
        }
      }
    }

    const contactSheet = await this.buildContactSheet(referenceImages);
    const prompt = this.buildVideoPrompt(product, script, visualBrief, referenceImages, cutoutUsed);
    return { product, prompt, script, visualBrief, referenceImages, primaryImageUrl, contactSheet, cutoutUsed };
  }

  private async generateScript(product: ErpProductCache): Promise<string> {
    const fallback = `${product.name} ราคาเพียง ฿${product.retailPrice} เหมาะสำหรับลูกค้าที่มองหาสินค้าคุณภาพในร้าน 100 บาท`;
    try {
      const res = await this.openAi.complete(
        'คุณเป็นนักเขียนสคริปต์วิดีโอขายสินค้า ตอบภาษาไทย กระชับ ไม่กล่าวอ้างเกินจริง',
        `เขียน voiceover 1-2 ประโยคสำหรับคลิปสินค้า 6 วินาที: ${product.name} หมวด ${product.category} ราคา ฿${product.retailPrice}`,
      );
      return res.content || fallback;
    } catch {
      return fallback;
    }
  }

  private defaultVisualBrief(): string {
    return [
      'Create a 6-second vertical product explainer video.',
      'Use the uploaded mascot as the speaking character reference when provided.',
      'Use the product image exactly as reference. Keep label and packaging recognizable.',
      'Scene: inside a bright ChangSiam 100 Baht Shop Thailand branch.',
      'Action: mascot holds or points to the product, smiles, and talks to camera.',
      'Camera: stable commercial product shot, 9:16 vertical, realistic retail advertisement.',
    ].join('\n');
  }

  private buildVideoPrompt(
    product: ErpProductCache,
    script: string,
    visualBrief: string,
    references: VideoReferenceImage[],
    cutoutUsed: boolean,
  ): string {
    const hasMascot = references.some((r) => r.label.includes('mascot'));
    return [
      visualBrief,
      '',
      `Product: ${product.name}`,
      `Category: ${product.category}`,
      `Voiceover: "${script}"`,
      '',
      'Reference rules:',
      hasMascot ? '- Preserve the mascot character appearance from the reference sheet.' : '- If no mascot is provided, make a simple product-only retail clip.',
      cutoutUsed ? '- Use the cutout product reference as the clean product hero.' : '- Use the product reference exactly and avoid changing packaging text.',
      '- Do not add SKU/product codes, watermarks, random Thai text, or medical claims.',
      '- Output should feel like a polished commercial short video.',
    ].join('\n');
  }

  private async loadBrandAsset(filename: string): Promise<VideoReferenceImage | null> {
    const safe = path.basename(filename);
    const filePath = path.join(this.brandAssetsDir, safe);
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    return {
      label: safe.includes('mascot') ? 'mascot reference' : 'brand logo reference',
      buffer,
      mimeType: this.mimeFromFilename(safe),
      url: `/media/brand-assets/${safe}`,
    };
  }

  private async fetchImage(url: string, label: string): Promise<VideoReferenceImage | null> {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    return { label, buffer: Buffer.from(await res.arrayBuffer()), mimeType: contentType, url };
  }

  private async cutoutProductImage(imageUrl: string, sku: string): Promise<Buffer | null> {
    const webhookUrl = await this.settings.get('n8n_promo_webhook_url');
    if (!webhookUrl?.startsWith('http')) return null;
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productImageUrl: imageUrl, sku }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`n8n returned HTTP ${res.status}`);
    const json = (await res.json()) as { cutoutBase64?: string };
    if (!json.cutoutBase64) throw new Error('n8n response missing cutoutBase64');
    return Buffer.from(json.cutoutBase64, 'base64');
  }

  private async buildContactSheet(images: VideoReferenceImage[]): Promise<VideoReferenceImage | undefined> {
    const refs = images.slice(0, 4);
    if (refs.length === 0) return undefined;

    const tiles = await Promise.all(
      refs.map(async (img, idx) => {
        const input = await sharp(img.buffer).resize(512, 512, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
        return { input, top: 0, left: idx * 512 };
      }),
    );
    const buffer = await sharp({
      create: {
        width: 512 * refs.length,
        height: 512,
        channels: 4,
        background: '#ffffff',
      },
    }).composite(tiles).png().toBuffer();

    return { label: 'video reference contact sheet', buffer, mimeType: 'image/png' };
  }

  private safeFilename(input: string): string {
    return input.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  }

  private mimeFromFilename(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.png')) return 'image/png';
    return 'image/jpeg';
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
