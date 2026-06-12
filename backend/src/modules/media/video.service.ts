import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { OpenAiService } from '../ai/openai.service';
import { ErpProductCache } from '../../database/entities/erp-product-cache.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface VideoGenerationResult {
  taskId: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  videoUrl?: string;
  localPath?: string;
  error?: string;
}

// Kling AI API types
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
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly uploadsDir: string;
  private readonly KLING_API_BASE = 'https://api.klingai.com/v1';

  constructor(
    @InjectRepository(ErpProductCache)
    private readonly productRepo: Repository<ErpProductCache>,
    private readonly openAi: OpenAiService,
    private readonly settings: SystemSettingsService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'media');
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  async isConfigured(): Promise<boolean> {
    const key = await this.settings.get('kling_api_key');
    return !!(key && key.length > 5);
  }

  /**
   * Submit a video generation task for a product.
   * Uses Kling AI image-to-video API.
   * Returns a task ID that can be polled for completion.
   */
  async submitProductVideo(sku: string): Promise<VideoGenerationResult> {
    const product = await this.productRepo.findOneBy({ sku });
    if (!product) throw new Error(`Product SKU "${sku}" not found`);

    const klingKey = await this.settings.get('kling_api_key');
    if (!klingKey) {
      throw new Error('KLING_NOT_CONFIGURED');
    }

    // Generate Thai voiceover script with GPT
    let script = `${product.name} ราคาเพียง ฿${product.retailPrice} หมวด ${product.category}`;
    try {
      const res = await this.openAi.complete(
        'คุณเป็นนักเขียน script โฆษณาสินค้า ตอบเป็นภาษาไทย 2-3 ประโยค',
        `เขียน script โฆษณาสั้น (2-3 ประโยค) สำหรับสินค้า: ${product.name} ราคา ฿${product.retailPrice}`,
      );
      script = res.content;
    } catch { /* use default script */ }

    const prompt = `Product showcase video for: ${product.name}. ${script}. Clean white background, professional product photography style, smooth camera movement.`;

    const body: Record<string, unknown> = {
      model_name: 'kling-v1',
      prompt,
      negative_prompt: 'text, watermark, low quality',
      cfg_scale: 0.5,
      mode: 'std',
      duration: '5',
    };

    // Use product image as reference if available
    if (product.imageUrl) {
      body['image_url'] = product.imageUrl;
    }

    const endpoint = product.imageUrl
      ? `${this.KLING_API_BASE}/videos/image2video`
      : `${this.KLING_API_BASE}/videos/text2video`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${klingKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Kling API error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as KlingTaskResponse;
    if (data.code !== 0 || !data.data?.task_id) {
      throw new Error(`Kling task creation failed: ${data.message}`);
    }

    return {
      taskId: data.data.task_id,
      status: 'queued',
    };
  }

  /**
   * Poll a Kling task for completion.
   * Returns current status + video URL when done.
   */
  async pollVideoTask(taskId: string, taskType: 'image2video' | 'text2video' = 'image2video'): Promise<VideoGenerationResult> {
    const klingKey = await this.settings.get('kling_api_key');
    if (!klingKey) throw new Error('KLING_NOT_CONFIGURED');

    const endpoint = `${this.KLING_API_BASE}/videos/${taskType}/${taskId}`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${klingKey}` },
    });

    if (!response.ok) {
      throw new Error(`Kling poll error ${response.status}`);
    }

    const data = (await response.json()) as KlingTaskResponse;
    const task = data.data;

    if (!task) throw new Error('No task data in response');

    if (task.task_status === 'succeed') {
      const videoUrl = task.task_result?.videos?.[0]?.url;
      return { taskId, status: 'done', videoUrl };
    }

    if (task.task_status === 'failed') {
      return { taskId, status: 'failed', error: 'Kling task failed' };
    }

    return { taskId, status: 'processing' };
  }

  /**
   * Submit + poll until done (max 5 minutes).
   * Downloads and saves video locally when complete.
   */
  async generateAndWait(sku: string): Promise<VideoGenerationResult> {
    const submitted = await this.submitProductVideo(sku);
    const { taskId } = submitted;

    this.logger.log(`Video task submitted: ${taskId} for SKU ${sku}`);

    // Poll every 10s for up to 5 minutes
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(10_000);
      const status = await this.pollVideoTask(taskId);

      if (status.status === 'done' && status.videoUrl) {
        // Download video
        const filename = `video-${sku}-${Date.now()}.mp4`;
        const localPath = path.join(this.uploadsDir, filename);
        try {
          await this.downloadFile(status.videoUrl, localPath);
          return {
            ...status,
            localPath: `/uploads/media/${filename}`,
          };
        } catch (dlErr) {
          this.logger.warn(`Video download failed: ${String(dlErr)}`);
          return status;
        }
      }

      if (status.status === 'failed') return status;
    }

    return { taskId, status: 'failed', error: 'Timeout waiting for video' };
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

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
