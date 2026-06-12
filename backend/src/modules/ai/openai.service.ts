import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiConfig } from '../../config/configuration';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export interface CompletionResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
}

export interface ImageGenerationResult {
  url: string;
  revisedPrompt?: string;
}

export interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly config: AiConfig;
  private client: OpenAI | null = null;
  private currentKey: string | null = null;

  constructor(
    configService: ConfigService,
    @Optional() private readonly settingsSvc?: SystemSettingsService,
  ) {
    this.config = configService.getOrThrow<AiConfig>('ai');
    if (this.config.apiKey) {
      this.client = new OpenAI({ apiKey: this.config.apiKey });
      this.currentKey = this.config.apiKey;
    } else {
      this.logger.warn('OPENAI_API_KEY ยังไม่ได้ตั้งค่าใน .env — ระบบจะลองโหลดจาก DB');
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Resolve the active API key: DB setting takes precedence over .env
   * Re-initializes client automatically when key changes.
   */
  private async ensureClient(): Promise<OpenAI> {
    let apiKey = this.config.apiKey || null;

    // DB key overrides env key
    if (this.settingsSvc) {
      const dbKey = await this.settingsSvc.get('openai_api_key');
      if (dbKey && dbKey.length > 5) {
        apiKey = dbKey;
      }
    }

    if (!apiKey) {
      throw new Error('OPENAI_NOT_CONFIGURED');
    }

    // Reinitialize when key changes
    if (!this.client || this.currentKey !== apiKey) {
      this.client = new OpenAI({ apiKey });
      this.currentKey = apiKey;
      this.logger.log('OpenAI client initialized');
    }

    return this.client;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<CompletionResult> {
    const client = await this.ensureClient();

    const completion = await client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const choice = completion.choices[0];
    return {
      content: choice?.message?.content?.trim() ?? '',
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      model: completion.model ?? this.config.model,
    };
  }

  /**
   * สตรีมคำตอบของผู้ช่วย AI ทีละ token ผ่าน callback `onToken`
   * คืนค่าเนื้อหาเต็ม + จำนวน token (ดึงจาก usage chunk สุดท้ายเมื่อมี)
   */
  async streamChat(
    messages: ChatMessageInput[],
    onToken: (delta: string) => void,
  ): Promise<CompletionResult> {
    const client = await this.ensureClient();

    const stream = await client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    });

    let content = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let model = this.config.model;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        content += delta;
        onToken(delta);
      }
      if (chunk.model) model = chunk.model;
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
        completionTokens = chunk.usage.completion_tokens ?? completionTokens;
      }
    }

    // fallback: ประมาณ token หาก provider ไม่ส่ง usage มากับ stream
    if (completionTokens === 0 && content) {
      completionTokens = Math.ceil(content.length / 4);
    }

    return { content: content.trim(), promptTokens, completionTokens, model };
  }

  /**
   * Generate an image via DALL-E 3 and return its temporary URL.
   * Caller is responsible for downloading + persisting the image.
   */
  async generateImage(
    prompt: string,
    options: { size?: '1024x1024' | '1792x1024' | '1024x1792'; quality?: 'standard' | 'hd' } = {},
  ): Promise<ImageGenerationResult> {
    try {
      const client = await this.ensureClient();
      const response = await client.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: options.size ?? '1024x1024',
        quality: options.quality ?? 'standard',
      });
      const img = response.data?.[0];
      if (!img?.url) throw new Error('DALL-E ไม่คืน URL รูป — ลองใหม่อีกครั้ง');
      return { url: img.url, revisedPrompt: img.revised_prompt ?? undefined };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'OPENAI_NOT_CONFIGURED') {
        throw new Error('ยังไม่ได้ตั้งค่า OpenAI API Key — ไปที่ หน้าตั้งค่า → AI Configuration');
      }
      const apiMsg =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: { message?: string } }).error?.message ?? '')
          : err instanceof Error
            ? err.message
            : String(err);
      if (apiMsg.includes('billing') || apiMsg.includes('quota')) {
        throw new Error('OpenAI billing/quota หมด — ตรวจสอบบัญชี OpenAI');
      }
      if (apiMsg.includes('content_policy') || apiMsg.includes('safety')) {
        throw new Error('DALL-E ปฏิเสธ prompt (content policy) — ระบบจะใช้รูป ERP แทน');
      }
      throw new Error(`DALL-E error: ${apiMsg.slice(0, 200)}`);
    }
  }

  /**
   * Analyze an image via GPT-4o Vision and return a text description.
   */
  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    const client = await this.ensureClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
  }
}
