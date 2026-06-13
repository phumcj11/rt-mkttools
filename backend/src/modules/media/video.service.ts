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
  VideoPlanResult,
  VideoPlanStep,
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
        benefits: assets.benefits,
        visualBrief: assets.visualBrief,
        cutoutUsed: assets.cutoutUsed,
        locale: assets.locale,
      },
    };
  }

  /** Preview the video pipeline (cutout → benefits → script → prompt) without submitting to a provider. */
  async buildVideoPlan(sku: string, options: VideoSubmitOptions = {}): Promise<VideoPlanResult> {
    const product = await this.productRepo.findOneBy({ sku });
    if (!product) throw new Error(`Product SKU "${sku}" not found`);

    const assets = await this.prepareAssets(product, options);
    const steps: VideoPlanStep[] = [
      {
        step: 'cutout',
        status: assets.cutoutUsed ? 'done' : options.useCutoutProductImage === false ? 'skipped' : 'failed',
        detail: assets.cutoutUsed
          ? 'Product die-cut ready'
          : options.useCutoutProductImage === false
            ? 'Die-cut disabled'
            : 'Die-cut unavailable — check n8n webhook in settings',
      },
      { step: 'benefits', status: 'done', detail: assets.benefits.join(' · ') },
      { step: 'script', status: 'done', detail: assets.script.slice(0, 120) },
      { step: 'prompt', status: 'done' },
    ];

    const cutoutRef = assets.referenceImages.find((img) => img.label.includes('product cutout'));
    return {
      sku: product.sku,
      productName: product.name,
      cutoutUsed: assets.cutoutUsed,
      cutoutUrl: cutoutRef?.url,
      benefits: assets.benefits,
      script: assets.script,
      visualBrief: assets.visualBrief,
      prompt: assets.prompt,
      locale: assets.locale,
      steps,
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
    const locale = options.locale ?? 'en';
    const useCutout = options.useCutoutProductImage !== false;
    const referenceImages: VideoReferenceImage[] = [];
    let primaryImageUrl = product.imageUrl || undefined;
    let cutoutUsed = false;

    // Step 1 — Die-cut product hero (product only, no background)
    if (product.imageUrl && useCutout) {
      const cutout = await this.cutoutProductImage(product.imageUrl, product.sku).catch((err) => {
        this.logger.warn(`Video cutout failed for ${product.sku}: ${String(err)}`);
        return null;
      });
      if (cutout) {
        const filename = `video-cutout-${this.safeFilename(product.sku)}-${Date.now()}.png`;
        fs.writeFileSync(path.join(this.uploadsDir, filename), cutout);
        primaryImageUrl = `${getApiBaseUrl()}/media/serve/${filename}`;
        referenceImages.push({
          label: 'product cutout',
          buffer: cutout,
          mimeType: 'image/png',
          url: primaryImageUrl,
        });
        cutoutUsed = true;
      }
    }

    if (!cutoutUsed && product.imageUrl) {
      const original = await this.fetchImage(product.imageUrl, 'product original');
      if (original) referenceImages.push(original);
    }

    // Optional mascot — not part of default explainer concept
    for (const filename of options.mascotAssetFilenames ?? []) {
      const asset = await this.loadBrandAsset(filename);
      if (asset) referenceImages.push(asset);
    }

    const analysisUrl = primaryImageUrl ?? product.imageUrl ?? undefined;

    // Step 2 — AI product benefits
    const benefits = await this.generateVideoBenefits(product, analysisUrl, locale);

    // Step 3 — Voiceover script
    const script = (options.script || await this.generateScript(product, benefits, locale)).trim();

    // Step 4 — Visual brief + final prompt
    const visualBrief = (options.visualBrief || this.defaultVisualBrief(locale)).trim();
    const productHero = referenceImages.find((img) => img.label.includes('product cutout'))
      ?? referenceImages.find((img) => img.label.includes('product'));
    const verticalFrame = productHero ? await this.buildProductHeroFrame(productHero) : undefined;
    const contactSheet = await this.buildContactSheet(referenceImages);
    const prompt = this.buildVideoPrompt(product, script, benefits, visualBrief, referenceImages, cutoutUsed, locale);

    return {
      product,
      prompt,
      script,
      benefits,
      visualBrief,
      locale,
      referenceImages,
      primaryImageUrl,
      contactSheet,
      verticalFrame,
      cutoutUsed,
    };
  }

  private async generateVideoBenefits(
    product: ErpProductCache,
    imageUrl: string | undefined,
    locale: 'en' | 'th',
  ): Promise<string[]> {
    const fallbackEn = [
      'Quality everyday product for daily use',
      'Easy to use and good value',
      'Popular choice for shoppers',
    ];
    const fallbackTh = [
      'สินค้าคุณภาพ ใช้งานได้จริงในชีวิตประจำวัน',
      'ใช้งานง่าย คุ้มค่า',
      'เป็นที่นิยมในร้านค้า',
    ];
    const fallback = locale === 'th' ? fallbackTh : fallbackEn;

    const prompt = locale === 'th'
      ? [
        'วิเคราะห์สินค้านี้และเขียน 3 ประโยคสรรพคุณที่ปลอดภัย สำหรับวิดีโออธิบายสินค้า 15 วินาที',
        'อธิบายว่าสินค้าช่วยอะไร / เหมาะกับใคร / ใช้ทำอะไร',
        'ภาษาไทย สั้น ไม่เกิน 10 คำต่อข้อ',
        'ห้ามกล่าวอ้างรักษาโรค ห้ามใส่ SKU',
        `ชื่อสินค้า: ${product.name}`,
        `หมวด: ${product.category}`,
      ].join('\n')
      : [
        'Analyze this retail product and write 3 short claim-safe benefits for a 15-second product explainer video.',
        'Explain what the product helps with, who it is for, or how it is used — for international shoppers who cannot read the packaging.',
        'Use English. Max 12 words per benefit. Be factual based on the product image and name.',
        'Avoid medical claims: no cure, treat, prevent disease, guaranteed results, doctor recommended.',
        'Do not include SKU, product codes, or price.',
        `Product name: ${product.name}`,
        `Category: ${product.category}`,
        product.brand ? `Brand: ${product.brand}` : '',
      ].filter(Boolean).join('\n');

    try {
      const content = imageUrl
        ? await this.openAi.analyzeImage(imageUrl, prompt)
        : (await this.openAi.complete(
          locale === 'th'
            ? 'คุณเป็นนักเขียน benefit สินค้าปลีก ตอบสั้น ปลอดภัย'
            : 'You write concise, claim-safe retail product benefits in English.',
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

  private async generateScript(
    product: ErpProductCache,
    benefits: string[],
    locale: 'en' | 'th',
  ): Promise<string> {
    const fallbackEn = `This is ${product.name}. ${benefits.slice(0, 2).join('. ')}. A practical choice for everyday use.`;
    const fallbackTh = `${product.name} ช่วย${benefits.slice(0, 2).join(' และ ')} เหมาะสำหรับใช้ในชีวิตประจำวัน`;

    try {
      const res = await this.openAi.complete(
        locale === 'th'
          ? 'คุณเป็นนักเขียนสคริปต์วิดีโออธิบายสินค้า ตอบภาษาไทย กระชับ ไม่กล่าวอ้างเกินจริง'
          : 'You write product explainer voiceover scripts in clear English for international retail shoppers.',
        locale === 'th'
          ? [
            'เขียน voiceover ภาษาไทย 15 วินาที อธิบายว่าสินค้าช่วยอะไร',
            'ใช้ benefit ที่ให้มาเท่านั้น ห้ามแต่งสรรพคุณรักษาโรค',
            `สินค้า: ${product.name}`,
            `หมวด: ${product.category}`,
            `จุดเด่น: ${benefits.join(' / ')}`,
          ].join('\n')
          : [
            'Write an English voiceover script for a 15-second vertical product explainer video.',
            'Audience: foreign customers who want to understand what this product does and how it helps.',
            'Start with what the product is, then explain 2-3 key benefits naturally.',
            'Use only the provided benefits — do not invent medical or exaggerated claims.',
            'No SKU or product codes. Friendly, clear, professional tone.',
            `Product: ${product.name}`,
            `Category: ${product.category}`,
            `Key benefits: ${benefits.join(' / ')}`,
          ].join('\n'),
      );
      return res.content || (locale === 'th' ? fallbackTh : fallbackEn);
    } catch {
      return locale === 'th' ? fallbackTh : fallbackEn;
    }
  }

  private defaultVisualBrief(locale: 'en' | 'th'): string {
    if (locale === 'th') {
      return [
        'สร้างวิดีโออธิบายสินค้าแนวตั้ง 15 วินาที พร้อมเสียง voiceover',
        'ฮีโร่: รูปสินค้า die-cut บนพื้นหลังเรียบสะอาด',
        'กล้อง: เคลื่อนไหวช้าๆ สินค้าอยู่กลางเฟรม ฉลากชัดเจน',
        'จุดประสงค์: ให้ลูกค้าเข้าใจว่าสินค้าช่วยอะไร',
        '9:16 แนวตั้ง สไตล์ explainer e-commerce',
      ].join('\n');
    }
    return [
      'Create a 15-second vertical product explainer video with native English audio.',
      'Hero: isolated product die-cut on a clean minimal white/soft gradient background.',
      'Camera: slow subtle motion — gentle push-in or soft parallax. Product stays centered; packaging label stays readable.',
      'Purpose: help international customers understand what this product is and what it helps with.',
      'No busy store background, no mascot, no collage. Product-focused e-commerce explainer.',
      '9:16 vertical, polished and professional.',
    ].join('\n');
  }

  private buildVideoPrompt(
    product: ErpProductCache,
    script: string,
    benefits: string[],
    visualBrief: string,
    references: VideoReferenceImage[],
    cutoutUsed: boolean,
    locale: 'en' | 'th',
  ): string {
    const hasMascot = references.some((r) => r.label.includes('mascot'));
    const voiceLabel = locale === 'th' ? 'Voiceover (Thai)' : 'Voiceover (English)';
    return [
      visualBrief,
      '',
      `Product: ${product.name}`,
      `Category: ${product.category}`,
      `Key benefits: ${benefits.join(' / ')}`,
      `${voiceLabel}: "${script}"`,
      '',
      'Visual rules:',
      cutoutUsed
        ? '- Use the die-cut product as the hero. Keep packaging text and shape exactly recognizable.'
        : '- Keep the product packaging exactly recognizable.',
      hasMascot
        ? '- Optional mascot may appear but product remains the focus.'
        : '- Product-only shot. No mascot or store clutter.',
      '- No SKU codes, watermarks, or medical claims.',
      '- Output: polished product explainer short video.',
    ].join('\n');
  }

  private async buildProductHeroFrame(product: VideoReferenceImage): Promise<VideoReferenceImage> {
    const width = 720;
    const height = 1280;
    const productWidth = Math.round(width * 0.74);
    const productHeight = Math.round(height * 0.58);
    const productBuf = await sharp(product.buffer)
      .resize(productWidth, productHeight, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    const buffer = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 248, g: 249, b: 252, alpha: 1 },
      },
    })
      .composite([{
        input: productBuf,
        top: Math.round(height * 0.2),
        left: Math.round((width - productWidth) / 2),
      }])
      .png()
      .toBuffer();

    return {
      label: 'vertical 9:16 product hero frame',
      buffer,
      mimeType: 'image/png',
    };
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
