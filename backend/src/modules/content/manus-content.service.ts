import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export interface ManusTaskInput {
  title: string;
  prompt: string;
  sourceImageUrl?: string;
  sku?: string | null;
}

export interface ManusTaskResult {
  taskId: string;
  taskUrl: string | null;
  raw: Record<string, unknown>;
}

@Injectable()
export class ManusContentService {
  private readonly logger = new Logger(ManusContentService.name);
  private readonly baseUrl = 'https://api.manus.ai/v2';

  constructor(private readonly settings: SystemSettingsService) {}

  async createImageTask(input: ManusTaskInput): Promise<ManusTaskResult> {
    const apiKey = await this.requireSetting('manus_api_key', 'content.manusNotConfigured');
    const projectId = await this.requireSetting('manus_project_id', 'content.manusProjectMissing');

    const content: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: [
          input.prompt,
          '',
          'Return the final generated image as an attachment or a publicly accessible image URL.',
          'Do not publish anywhere. The output must wait for approval in the source system.',
          input.sku ? `SKU: ${input.sku}` : '',
        ].filter(Boolean).join('\n'),
      },
    ];
    if (input.sourceImageUrl?.startsWith('http')) {
      content.push({
        type: 'file',
        file_url: input.sourceImageUrl,
        filename: `${input.sku ?? 'product'}-reference.jpg`,
        mime_type: 'image/jpeg',
      });
    }

    const body = {
      project_id: projectId,
      title: input.title,
      input: content,
    };

    const json = await this.call<Record<string, unknown>>('/task.create', apiKey, body);
    const task = (json.task ?? json) as Record<string, unknown>;
    const taskId = String(task.task_id ?? task.id ?? json.task_id ?? '');
    if (!taskId) {
      this.logger.warn(`Manus task.create returned no task id: ${JSON.stringify(json).slice(0, 500)}`);
      throw new AppException('content.manusTaskFailed', HttpStatus.BAD_GATEWAY);
    }
    return {
      taskId,
      taskUrl: typeof task.task_url === 'string' ? task.task_url : typeof task.url === 'string' ? task.url : null,
      raw: json,
    };
  }

  async listTaskMessages(taskId: string): Promise<Record<string, unknown>> {
    const apiKey = await this.requireSetting('manus_api_key', 'content.manusNotConfigured');
    return this.call<Record<string, unknown>>('/task.listMessages', apiKey, { task_id: taskId });
  }

  extractImageUrl(payload: unknown): string | null {
    const seen = new Set<unknown>();
    const walk = (value: unknown): string | null => {
      if (!value || seen.has(value)) return null;
      if (typeof value === 'string') {
        return /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(value) ? value : null;
      }
      if (typeof value !== 'object') return null;
      seen.add(value);
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = walk(item);
          if (found) return found;
        }
        return null;
      }
      const obj = value as Record<string, unknown>;
      for (const key of ['image_url', 'imageUrl', 'url', 'file_url', 'download_url']) {
        const found = walk(obj[key]);
        if (found) return found;
      }
      for (const item of Object.values(obj)) {
        const found = walk(item);
        if (found) return found;
      }
      return null;
    };
    return walk(payload);
  }

  private async requireSetting(key: string, code: string): Promise<string> {
    const value = (await this.settings.get(key))?.trim();
    if (!value) throw new AppException(code, HttpStatus.BAD_REQUEST);
    return value;
  }

  private async call<T>(path: string, apiKey: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-manus-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      this.logger.warn(`Manus API ${path} failed: HTTP ${res.status} ${JSON.stringify(json).slice(0, 500)}`);
      throw new AppException('content.manusUnavailable', HttpStatus.BAD_GATEWAY);
    }
    return json as T;
  }
}
