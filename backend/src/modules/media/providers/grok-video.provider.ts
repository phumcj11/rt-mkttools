import { Injectable, Logger } from '@nestjs/common';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_RESOLUTION,
  PreparedVideoAssets,
  VideoGenerationConfig,
  VideoGenerationResult,
  VideoPollOptions,
  VideoProvider,
  VideoReferenceImage,
  VIDEO_PROVIDER_MODELS,
} from '../video.types';

interface GrokStartResponse {
  request_id?: string;
}

interface GrokPollResponse {
  status?: 'pending' | 'done' | 'failed' | 'expired';
  video?: { url?: string; duration?: number };
  error?: { message?: string };
  model?: string;
}

@Injectable()
export class GrokVideoProvider implements VideoProvider {
  readonly id = 'grok' as const;
  readonly defaultModel = VIDEO_PROVIDER_MODELS.grok[0];
  readonly models = VIDEO_PROVIDER_MODELS.grok;
  private readonly apiBase = 'https://api.x.ai/v1';
  private readonly logger = new Logger(GrokVideoProvider.name);

  constructor(private readonly settings: SystemSettingsService) {}

  async isConfigured(): Promise<boolean> {
    const key = await this.settings.get('grok_api_key');
    return !!(key && key.length > 5);
  }

  async submit(
    assets: PreparedVideoAssets,
    options: VideoGenerationConfig,
  ): Promise<VideoGenerationResult> {
    const apiKey = await this.settings.get('grok_api_key');
    if (!apiKey) throw new Error('Grok API Key ยังไม่ได้ตั้งค่า');

    const model = options.model || this.defaultModel;
    const body = this.buildRequestBody(assets, {
      model,
      duration: options.duration ?? DEFAULT_VIDEO_DURATION,
      aspectRatio: options.aspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO,
      resolution: options.resolution ?? DEFAULT_VIDEO_RESOLUTION,
    });

    this.logger.log(
      `Grok video submit sku=${assets.product.sku} mode=${body.mode} duration=${body.payload.duration} aspect=${configAspect(body.payload)}`,
    );
    this.logger.debug(`Grok prompt:\n${String(body.payload.prompt)}`);

    const response = await fetch(`${this.apiBase}/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body.payload),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`Grok Video API error ${response.status}: ${(await response.text()).slice(0, 400)}`);
    }

    const data = (await response.json()) as GrokStartResponse;
    if (!data.request_id) {
      throw new Error('Grok Video response missing request_id');
    }

    return {
      taskId: data.request_id,
      provider: this.id,
      model,
      status: 'queued',
      pollAfterSeconds: 10,
      metadata: {
        requestId: data.request_id,
        cutoutUsed: assets.cutoutUsed,
        mode: body.mode,
        promptSent: String(body.payload.prompt),
        script: assets.script,
        duration: body.payload.duration,
        aspectRatio: body.payload.aspect_ratio,
        resolution: body.payload.resolution,
      },
    };
  }

  async poll(taskId: string, options: VideoPollOptions): Promise<VideoGenerationResult> {
    const apiKey = await this.settings.get('grok_api_key');
    if (!apiKey) throw new Error('Grok API Key ยังไม่ได้ตั้งค่า');

    const requestId = (options.metadata?.requestId as string | undefined) ?? taskId;
    const response = await fetch(`${this.apiBase}/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`Grok Video poll error ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const data = (await response.json()) as GrokPollResponse;
    const model = options.model || this.defaultModel;

    if (data.status === 'failed' || data.status === 'expired') {
      return {
        taskId,
        provider: this.id,
        model,
        status: 'failed',
        error: data.error?.message || `Grok video ${data.status}`,
        metadata: { ...options.metadata, requestId },
      };
    }

    if (data.status === 'done') {
      return {
        taskId,
        provider: this.id,
        model: data.model || model,
        status: 'done',
        videoUrl: data.video?.url,
        metadata: { ...options.metadata, requestId },
      };
    }

    return {
      taskId,
      provider: this.id,
      model,
      status: 'processing',
      pollAfterSeconds: 10,
      metadata: { ...options.metadata, requestId },
    };
  }

  private buildRequestBody(
    assets: PreparedVideoAssets,
    config: Required<Pick<VideoGenerationConfig, 'model' | 'duration' | 'aspectRatio' | 'resolution'>>,
  ): { payload: Record<string, unknown>; mode: string } {
    const requestedDuration = Math.min(15, Math.max(1, config.duration));
    const base = {
      model: config.model,
      aspect_ratio: config.aspectRatio,
      resolution: config.resolution,
    };

    const frameRefs = assets.referenceImages.filter((img) => !img.label.includes('product original'));
    const mascotRefs = frameRefs.filter((img) => img.label.includes('mascot'));
    const hasMultipleRefs = frameRefs.length >= 2 && mascotRefs.length > 0;
    const useReferenceMode = hasMultipleRefs && requestedDuration <= 10;

    if (useReferenceMode) {
      const refs = frameRefs.slice(0, 4);
      const prompt = this.buildReferencePrompt(assets, refs);
      return {
        mode: 'reference-to-video',
        payload: {
          ...base,
          duration: Math.min(10, requestedDuration),
          prompt,
          reference_images: refs.map((img) => ({ url: this.toDataUri(img) })),
        },
      };
    }

    const hero =
      assets.verticalFrame ??
      frameRefs.find((img) => img.label.includes('product cutout')) ??
      frameRefs.find((img) => img.label.includes('product')) ??
      frameRefs[0];

    if (hero) {
      const prompt = this.buildImageToVideoPrompt(assets);
      return {
        mode: 'image-to-video',
        payload: {
          ...base,
          duration: requestedDuration,
          prompt,
          image: this.toImagePayload(hero),
        },
      };
    }

    const prompt = this.buildTextToVideoPrompt(assets);
    return {
      mode: 'text-to-video',
      payload: {
        ...base,
        duration: requestedDuration,
        prompt,
      },
    };
  }

  private buildImageToVideoPrompt(assets: PreparedVideoAssets): string {
    const hasMascot = assets.referenceImages.some((img) => img.label.includes('mascot'));
    return [
      assets.visualBrief,
      '',
      'Animate this 9:16 vertical starter frame into one unified mobile product ad.',
      'Fill the entire vertical frame edge-to-edge. No letterboxing, no side panels, no collage layout.',
      hasMascot
        ? 'Keep the mascot character appearance exactly. Mascot presents the product to camera.'
        : 'Keep product packaging and label exactly recognizable.',
      'Scene: bright ChangSiam 100 Baht Shop Thailand retail store, cinematic lighting, smooth camera push-in.',
      '',
      `Product: ${assets.product.name}`,
      `Category: ${assets.product.category}`,
      `Safe benefits: ${assets.benefits.join(' / ')}`,
      '',
      this.audioBlock(assets.script),
    ].join('\n');
  }

  private buildReferencePrompt(assets: PreparedVideoAssets, refs: VideoReferenceImage[]): string {
    const labels = refs.map((_, idx) => `<IMAGE_${idx + 1}>`).join(', ');
    return [
      assets.visualBrief,
      '',
      `Use reference images ${labels}.`,
      refs.some((r) => r.label.includes('mascot'))
        ? 'The mascot from the mascot reference speaks to camera and presents the product from the product reference.'
        : 'Present the product from the reference images naturally.',
      'Full-frame vertical 9:16 mobile ad. No collage, no letterboxing.',
      `Product: ${assets.product.name}`,
      `Safe benefits: ${assets.benefits.join(' / ')}`,
      'Scene: bright ChangSiam 100 Baht Shop Thailand retail store.',
      'Do not add SKU codes, watermarks, or medical claims.',
      '',
      this.audioBlock(assets.script),
    ].join('\n');
  }

  private buildTextToVideoPrompt(assets: PreparedVideoAssets): string {
    return [
      assets.prompt,
      'Full-frame vertical 9:16 mobile product advertisement.',
      this.audioBlock(assets.script),
    ].join('\n\n');
  }

  private audioBlock(script: string): string {
    return [
      'AUDIO:',
      `Thai voiceover narration in a friendly retail tone: "${script}"`,
      'Include synchronized spoken Thai voiceover and subtle upbeat retail background music.',
      'Not silent — audio must be present throughout the clip.',
      'Mascot can lip-sync or gesture while the voiceover plays.',
    ].join('\n');
  }

  private toDataUri(img: VideoReferenceImage): string {
    return `data:${img.mimeType};base64,${img.buffer.toString('base64')}`;
  }

  private toImagePayload(img: VideoReferenceImage): { url: string } {
    if (img.url?.startsWith('http')) {
      return { url: img.url };
    }
    return { url: this.toDataUri(img) };
  }
}

function configAspect(payload: Record<string, unknown>): string {
  return typeof payload.aspect_ratio === 'string' ? payload.aspect_ratio : 'unknown';
}
