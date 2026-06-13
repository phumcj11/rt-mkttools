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
import { GrokVideoProvider } from './providers/grok-video.provider';
import { KlingVideoProvider } from './providers/kling-video.provider';
import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_PROVIDER,
  DEFAULT_VIDEO_RESOLUTION,
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
    private readonly grok: GrokVideoProvider,
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
    const generationConfig = {
      model,
      duration: options.duration ?? DEFAULT_VIDEO_DURATION,
      aspectRatio: options.aspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO,
      resolution: options.resolution ?? DEFAULT_VIDEO_RESOLUTION,
    };
    const result = await provider.submit(assets, generationConfig);
    return {
      ...result,
      metadata: {
        ...result.metadata,
        sku: product.sku,
        script: assets.script,
        visualBrief: assets.visualBrief,
      },
    };
  }

  async pollVideoTask(taskId: string, options: VideoPollOptions = {}): Promise<VideoGenerationResult> {
    const providerId = options.provider ?? await this.resolveProvider();
    const result = await this.getProvider(providerId).poll(taskId, {
      ...options,
      provider: providerId,
      model: options.model || await this.resolveModel(providerId),
    });
    if (result.status === 'done' && result.videoUrl && !result.localPath) {
      const sku = typeof result.metadata?.sku === 'string' ? result.metadata.sku : 'video';
      const localPath = await this.saveCompletedVideo(result.videoUrl, sku, result.metadata).catch((err) => {
        this.logger.warn(`Video save failed for ${taskId}: ${String(err)}`);
        return null;
      });
      if (localPath) return { ...result, localPath };
    }
    return result;
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
        try {
          const localPath = await this.saveCompletedVideo(status.videoUrl, sku, status.metadata);
          return {
            ...status,
            localPath,
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

    const headers: Record<string, string> = {};
    const apiKey = this.extractApiKeyFromUrl(url);
    if (apiKey) headers['x-goog-api-key'] = apiKey;

    const res = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(120_000),
    });
    const contentType = res.headers.get('content-type') ?? '';
    const buffer = Buffer.from(await res.arrayBuffer());

    if (!res.ok) {
      throw new Error(`download returned HTTP ${res.status}: ${buffer.toString('utf8', 0, 300)}`);
    }
    if (buffer.length < 1024 || contentType.includes('application/json') || buffer[0] === 0x7b) {
      throw new Error(`download did not return a valid video (${contentType || 'unknown'}, ${buffer.length} bytes): ${buffer.toString('utf8', 0, 300)}`);
    }

    fs.writeFileSync(dest, buffer);
  }

  private async saveCompletedVideo(videoUrl: string, sku: string, metadata?: Record<string, unknown>): Promise<string> {
    const filename = `video-${this.safeFilename(sku)}-${Date.now()}.mp4`;
    const localFilePath = path.join(this.uploadsDir, filename);
    const downloadableUrl = await this.resolveDownloadUrl(videoUrl, metadata);
    await this.downloadFile(downloadableUrl, localFilePath);
    return `/media/serve/${filename}`;
  }

  private async resolveDownloadUrl(videoUrl: string, metadata?: Record<string, unknown>): Promise<string> {
    if (!videoUrl.includes('generativelanguage.googleapis.com')) return videoUrl;
    const apiKey = await this.settings.get('gemini_api_key');
    if (!apiKey) return videoUrl;
    const separator = videoUrl.includes('?') ? '&' : '?';
    const url = `${videoUrl}${separator}key=${encodeURIComponent(apiKey)}`;
    if (url.includes('alt=media')) return url;
    return `${url}&alt=media`;
  }

  private extractApiKeyFromUrl(url: string): string | null {
    try {
      return new URL(url).searchParams.get('key');
    } catch {
      return null;
    }
  }

  private getProvider(id: VideoProviderId): VideoProvider {
    if (id === 'gemini') return this.gemini;
    if (id === 'kling') return this.kling;
    if (id === 'grok') return this.grok;
    throw new Error(`Unknown video provider: ${id}`);
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
    const benefits = await this.generateVideoBenefits(product);
    const script = (options.script || await this.generateScript(product, benefits)).trim();
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
    const frameSources = referenceImages.filter((img) => !img.label.includes('product original'));
    const verticalFrame = await this.buildVerticalVideoFrame(frameSources);
    const prompt = this.buildVideoPrompt(product, script, benefits, visualBrief, referenceImages, cutoutUsed);
    return {
      product,
      prompt,
      script,
      benefits,
      visualBrief,
      referenceImages,
      primaryImageUrl,
      contactSheet,
      verticalFrame,
      cutoutUsed,
    };
  }

  private async generateVideoBenefits(product: ErpProductCache): Promise<string[]> {
    const fallback = [
      'สินค้าคุณภาพ คุ้มค่าสำหรับลูกค้า',
      'เหมาะสำหรับใช้ในชีวิตประจำวัน',
      'หาซื้อง่ายที่ 100 Baht Shop',
    ];
    const prompt = [
      'Analyze this retail product and write 3 short claim-safe benefits for a 15-second product explainer video.',
      'Use Thai language. Keep each benefit under 8 Thai words.',
      'Avoid medical claims: do not say cure, treat, prevent disease, guaranteed result, doctor recommended, medicine.',
      'Do not include SKU, product code, ERP/catalog text, or price.',
      `Product name: ${product.name}`,
      `Category: ${product.category}`,
    ].join('\n');

    try {
      const content = product.imageUrl
        ? await this.openAi.analyzeImage(product.imageUrl, prompt)
        : (await this.openAi.complete(
          'คุณเป็นนักเขียน benefit สินค้าปลีก ตอบสั้น ปลอดภัย ไม่กล่าวอ้างรักษาโรค',
          prompt,
        )).content;
      const lines = content
        .split('\n')
        .map((line) => line.replace(/^[-*\d\.\)\s]+/, '').trim())
        .filter((line) => line.length > 2)
        .slice(0, 3);
      return lines.length > 0 ? lines : fallback;
    } catch (err) {
      this.logger.warn(`Video benefit generation failed for ${product.sku}: ${String(err)}`);
      return fallback;
    }
  }

  private async generateScript(product: ErpProductCache, benefits: string[]): Promise<string> {
    const fallback = `${product.name} จุดเด่นคือ ${benefits.slice(0, 2).join(' และ ')} แวะเลือกซื้อได้ที่ 100 Baht Shop`;
    try {
      const res = await this.openAi.complete(
        'คุณเป็นนักเขียนสคริปต์วิดีโอขายสินค้า ตอบภาษาไทย กระชับ ไม่กล่าวอ้างเกินจริง',
        [
          'เขียน voiceover ภาษาไทยสำหรับคลิปสินค้า 15 วินาที',
          'ให้ mascot พูดแนะนำสินค้าแบบเป็นธรรมชาติ พูดได้ครบทั้ง benefit ที่ให้มา',
          'ใช้ benefit ที่ให้มาเท่านั้น ห้ามแต่งสรรพคุณรักษาโรคเพิ่ม',
          'ห้ามพูด SKU/product code',
          `สินค้า: ${product.name}`,
          `หมวด: ${product.category}`,
          `ราคา: ฿${product.retailPrice}`,
          `จุดเด่นปลอดภัย: ${benefits.join(' / ')}`,
        ].join('\n'),
      );
      return res.content || fallback;
    } catch {
      return fallback;
    }
  }

  private defaultVisualBrief(): string {
    return [
      'Create a 15-second vertical product explainer video with native audio.',
      'Use the uploaded mascot as the speaking character reference when provided.',
      'Use the product image exactly as reference. Keep label and packaging recognizable.',
      'Scene: inside a bright ChangSiam 100 Baht Shop Thailand branch.',
      'Action: mascot holds or points to the product, smiles, and talks to camera with voiceover.',
      'Camera: stable commercial product shot, 9:16 vertical, realistic retail advertisement with sound.',
    ].join('\n');
  }

  private buildVideoPrompt(
    product: ErpProductCache,
    script: string,
    benefits: string[],
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
      `Safe product benefits: ${benefits.join(' / ')}`,
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

  private async buildVerticalVideoFrame(images: VideoReferenceImage[]): Promise<VideoReferenceImage | undefined> {
    if (images.length === 0) return undefined;

    const width = 720;
    const height = 1280;
    const mascot = images.find((img) => img.label.includes('mascot'));
    const product =
      images.find((img) => img.label.includes('product cutout')) ??
      images.find((img) => img.label.includes('product'));

    const layers: sharp.OverlayOptions[] = [];

    if (mascot) {
      const mascotWidth = Math.round(width * 0.82);
      const mascotHeight = Math.round(height * 0.4);
      const mascotBuf = await sharp(mascot.buffer)
        .resize(mascotWidth, mascotHeight, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
      layers.push({
        input: mascotBuf,
        top: Math.round(height * 0.06),
        left: Math.round((width - mascotWidth) / 2),
      });
    }

    if (product) {
      const productWidth = Math.round(width * 0.52);
      const productHeight = Math.round(height * 0.34);
      const productBuf = await sharp(product.buffer)
        .resize(productWidth, productHeight, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
      layers.push({
        input: productBuf,
        top: Math.round(height * 0.5),
        left: Math.round((width - productWidth) / 2),
      });
    }

    if (layers.length === 0) {
      const single = images[0];
      const singleBuf = await sharp(single.buffer)
        .resize(width, height, { fit: 'contain', background: { r: 250, g: 250, b: 252, alpha: 1 } })
        .png()
        .toBuffer();
      return {
        label: 'vertical 9:16 video starter frame',
        buffer: singleBuf,
        mimeType: 'image/png',
      };
    }

    const buffer = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 250, g: 250, b: 252, alpha: 1 },
      },
    })
      .composite(layers)
      .png()
      .toBuffer();

    return {
      label: 'vertical 9:16 video starter frame',
      buffer,
      mimeType: 'image/png',
    };
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
