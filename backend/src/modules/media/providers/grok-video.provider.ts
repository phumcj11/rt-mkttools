import { Injectable } from '@nestjs/common';
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
    const duration = Math.min(15, Math.max(1, config.duration));
    const base = {
      model: config.model,
      duration,
      aspect_ratio: config.aspectRatio,
      resolution: config.resolution,
    };

    const mascotRefs = assets.referenceImages.filter((img) => img.label.includes('mascot'));
    const hasMultipleRefs = assets.referenceImages.length >= 2 && mascotRefs.length > 0;

    if (hasMultipleRefs) {
      const refs = assets.referenceImages.slice(0, 4);
      return {
        mode: 'reference-to-video',
        payload: {
          ...base,
          prompt: this.buildReferencePrompt(assets, refs),
          reference_images: refs.map((img) => ({ url: this.toDataUri(img) })),
        },
      };
    }

    const hero =
      assets.referenceImages.find((img) => img.label.includes('product cutout')) ??
      assets.referenceImages.find((img) => img.label.includes('product')) ??
      assets.referenceImages[0];

    if (hero) {
      return {
        mode: 'image-to-video',
        payload: {
          ...base,
          prompt: this.enhancePrompt(assets.prompt, assets.script),
          image: this.toDataUri(hero),
        },
      };
    }

    return {
      mode: 'text-to-video',
      payload: {
        ...base,
        prompt: this.enhancePrompt(assets.prompt, assets.script),
      },
    };
  }

  private buildReferencePrompt(assets: PreparedVideoAssets, refs: VideoReferenceImage[]): string {
    const labels = refs.map((_, idx) => `<IMAGE_${idx + 1}>`).join(', ');
    return [
      this.enhancePrompt(assets.visualBrief, assets.script),
      '',
      `Use reference images ${labels}.`,
      refs.some((r) => r.label.includes('mascot'))
        ? 'The mascot from the mascot reference speaks to camera and presents the product from the product reference.'
        : 'Present the product from the reference images naturally.',
      `Product: ${assets.product.name}`,
      `Safe benefits: ${assets.benefits.join(' / ')}`,
      'Scene: bright ChangSiam 100 Baht Shop Thailand retail store.',
      'Do not add SKU codes, watermarks, or medical claims.',
    ].join('\n');
  }

  private enhancePrompt(prompt: string, script: string): string {
    return [
      prompt,
      '',
      'Audio requirements: include native audio with clear spoken Thai voiceover throughout the clip.',
      `Thai voiceover script (speak naturally, complete all lines): "${script}"`,
      'Camera: stable vertical 9:16 product advertisement for mobile reels/TikTok with ambient store sound.',
      'Quality: cinematic lighting, smooth motion, recognizable product packaging.',
    ].join('\n');
  }

  private toDataUri(img: VideoReferenceImage): string {
    return `data:${img.mimeType};base64,${img.buffer.toString('base64')}`;
  }
}
