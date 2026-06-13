import { Injectable } from '@nestjs/common';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  PreparedVideoAssets,
  VideoGenerationResult,
  VideoPollOptions,
  VideoProvider,
  VIDEO_PROVIDER_MODELS,
} from '../video.types';

interface GeminiOperationResponse {
  name?: string;
  done?: boolean;
  error?: { message?: string; code?: number };
  response?: {
    generatedVideos?: Array<{
      video?: {
        uri?: string;
        bytesBase64Encoded?: string;
      };
    }>;
  };
}

@Injectable()
export class GeminiVideoProvider implements VideoProvider {
  readonly id = 'gemini' as const;
  readonly defaultModel = VIDEO_PROVIDER_MODELS.gemini[0];
  readonly models = VIDEO_PROVIDER_MODELS.gemini;
  private readonly apiBase = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(private readonly settings: SystemSettingsService) {}

  async isConfigured(): Promise<boolean> {
    const key = await this.settings.get('gemini_api_key');
    return !!(key && key.length > 5);
  }

  async submit(
    assets: PreparedVideoAssets,
    options: { model: string },
  ): Promise<VideoGenerationResult> {
    const apiKey = await this.settings.get('gemini_api_key');
    if (!apiKey) throw new Error('Gemini API Key ยังไม่ได้ตั้งค่า');

    const model = options.model || this.defaultModel;
    const image = assets.contactSheet ?? assets.referenceImages[0];
    const instances: Record<string, unknown>[] = [{ prompt: assets.prompt }];
    if (image) {
      instances[0].image = {
        bytesBase64Encoded: image.buffer.toString('base64'),
        mimeType: image.mimeType,
      };
    }

    const response = await fetch(`${this.apiBase}/models/${model}:predictLongRunning?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances,
        parameters: {
          aspectRatio: '9:16',
          sampleCount: 1,
          durationSeconds: 6,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`Gemini Video API error ${response.status}: ${(await response.text()).slice(0, 400)}`);
    }

    const data = (await response.json()) as GeminiOperationResponse;
    if (!data.name) {
      throw new Error('Gemini Video response missing operation name');
    }

    return {
      taskId: data.name,
      provider: this.id,
      model,
      status: data.done ? 'done' : 'queued',
      videoUrl: this.extractVideoUrl(data),
      pollAfterSeconds: 15,
      metadata: { operationName: data.name, cutoutUsed: assets.cutoutUsed },
    };
  }

  async poll(taskId: string, options: VideoPollOptions): Promise<VideoGenerationResult> {
    const apiKey = await this.settings.get('gemini_api_key');
    if (!apiKey) throw new Error('Gemini API Key ยังไม่ได้ตั้งค่า');

    const operationName = (options.metadata?.operationName as string | undefined) ?? taskId;
    const response = await fetch(`${this.apiBase}/${operationName}?key=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`Gemini Video poll error ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const data = (await response.json()) as GeminiOperationResponse;
    if (data.error) {
      return {
        taskId,
        provider: this.id,
        model: options.model || this.defaultModel,
        status: 'failed',
        error: data.error.message || 'Gemini video task failed',
        metadata: { operationName },
      };
    }

    if (!data.done) {
      return {
        taskId,
        provider: this.id,
        model: options.model || this.defaultModel,
        status: 'processing',
        pollAfterSeconds: 15,
        metadata: { operationName },
      };
    }

    return {
      taskId,
      provider: this.id,
      model: options.model || this.defaultModel,
      status: 'done',
      videoUrl: this.extractVideoUrl(data),
      metadata: { operationName },
    };
  }

  private extractVideoUrl(data: GeminiOperationResponse): string | undefined {
    const video = data.response?.generatedVideos?.[0]?.video;
    if (video?.uri) return video.uri;
    if (video?.bytesBase64Encoded) return `data:video/mp4;base64,${video.bytesBase64Encoded}`;
    return undefined;
  }
}
