import { Injectable } from '@nestjs/common';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  PreparedVideoAssets,
  VideoGenerationResult,
  VideoPollOptions,
  VideoProvider,
  VIDEO_PROVIDER_MODELS,
} from '../video.types';

interface KlingTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data?: {
    task_id: string;
    task_status: string;
    task_result?: {
      videos?: { url: string; duration: string }[];
    };
  };
}

@Injectable()
export class KlingVideoProvider implements VideoProvider {
  readonly id = 'kling' as const;
  readonly defaultModel = VIDEO_PROVIDER_MODELS.kling[0];
  readonly models = VIDEO_PROVIDER_MODELS.kling;
  private readonly apiBase = 'https://api.klingai.com/v1';

  constructor(private readonly settings: SystemSettingsService) {}

  async isConfigured(): Promise<boolean> {
    const key = await this.settings.get('kling_api_key');
    return !!(key && key.length > 5);
  }

  async submit(
    assets: PreparedVideoAssets,
    options: { model: string },
  ): Promise<VideoGenerationResult> {
    const apiKey = await this.settings.get('kling_api_key');
    if (!apiKey) throw new Error('Kling API Key ยังไม่ได้ตั้งค่า');

    const hasImage = !!assets.primaryImageUrl;
    const body: Record<string, unknown> = {
      model_name: options.model || this.defaultModel,
      prompt: assets.prompt,
      negative_prompt: 'text, watermark, low quality, distorted product, wrong mascot, extra hands',
      cfg_scale: 0.5,
      mode: 'std',
      duration: '5',
    };

    if (hasImage) body.image_url = assets.primaryImageUrl;

    const taskType = hasImage ? 'image2video' : 'text2video';
    const response = await fetch(`${this.apiBase}/videos/${taskType}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Kling API error ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const data = (await response.json()) as KlingTaskResponse;
    if (data.code !== 0 || !data.data?.task_id) {
      throw new Error(`Kling task creation failed: ${data.message}`);
    }

    return {
      taskId: data.data.task_id,
      provider: this.id,
      model: options.model || this.defaultModel,
      status: 'queued',
      pollAfterSeconds: 10,
      metadata: { taskType, cutoutUsed: assets.cutoutUsed },
    };
  }

  async poll(taskId: string, options: VideoPollOptions): Promise<VideoGenerationResult> {
    const apiKey = await this.settings.get('kling_api_key');
    if (!apiKey) throw new Error('Kling API Key ยังไม่ได้ตั้งค่า');

    const taskType = options.taskType ?? (options.metadata?.taskType as 'image2video' | 'text2video' | undefined) ?? 'image2video';
    const response = await fetch(`${this.apiBase}/videos/${taskType}/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Kling poll error ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }

    const data = (await response.json()) as KlingTaskResponse;
    const task = data.data;
    if (!task) throw new Error('No task data in Kling response');

    if (task.task_status === 'succeed') {
      return {
        taskId,
        provider: this.id,
        model: options.model || this.defaultModel,
        status: 'done',
        videoUrl: task.task_result?.videos?.[0]?.url,
        metadata: { taskType },
      };
    }

    if (task.task_status === 'failed') {
      return {
        taskId,
        provider: this.id,
        model: options.model || this.defaultModel,
        status: 'failed',
        error: 'Kling task failed',
        metadata: { taskType },
      };
    }

    return {
      taskId,
      provider: this.id,
      model: options.model || this.defaultModel,
      status: 'processing',
      pollAfterSeconds: 10,
      metadata: { taskType },
    };
  }
}
