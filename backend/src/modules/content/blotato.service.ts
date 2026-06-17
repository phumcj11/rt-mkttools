import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export interface BlotatoPostInput {
  text: string;
  mediaUrls: string[];
  platform: string;
  scheduledAt?: Date | null;
}

@Injectable()
export class BlotatoService {
  private readonly logger = new Logger(BlotatoService.name);
  private readonly baseUrl = 'https://backend.blotato.com/v2';

  constructor(private readonly settings: SystemSettingsService) {}

  async createPost(input: BlotatoPostInput): Promise<Record<string, unknown>> {
    const apiKey = await this.requireSetting('blotato_api_key', 'content.blotatoNotConfigured');
    const accountId = await this.requireSetting('blotato_account_id', 'content.blotatoAccountMissing');

    const target = await this.buildTarget(input.platform);
    const body: Record<string, unknown> = {
      post: {
        accountId,
        content: {
          text: input.text,
          mediaUrls: input.mediaUrls,
          platform: input.platform,
        },
        target,
      },
    };
    if (input.scheduledAt) {
      body.scheduledTime = input.scheduledAt.toISOString();
    }
    return this.call<Record<string, unknown>>('/posts', apiKey, {
      method: 'POST',
      body,
    });
  }

  async getPostStatus(postSubmissionId: string): Promise<Record<string, unknown>> {
    const apiKey = await this.requireSetting('blotato_api_key', 'content.blotatoNotConfigured');
    return this.call<Record<string, unknown>>(`/posts/${encodeURIComponent(postSubmissionId)}`, apiKey, {
      method: 'GET',
    });
  }

  async getAccounts(): Promise<Record<string, unknown>> {
    const apiKey = await this.requireSetting('blotato_api_key', 'content.blotatoNotConfigured');
    return this.call<Record<string, unknown>>('/users/me/accounts', apiKey, { method: 'GET' });
  }

  private async buildTarget(platform: string): Promise<Record<string, unknown>> {
    const normalized = platform === 'facebook_page' ? 'facebook' : platform;
    if (normalized === 'facebook') {
      const pageId = await this.settings.get('blotato_facebook_page_id');
      if (!pageId) throw new AppException('content.blotatoFacebookPageMissing', HttpStatus.BAD_REQUEST);
      return { targetType: 'facebook', pageId };
    }
    if (normalized === 'tiktok') {
      return {
        targetType: 'tiktok',
        privacyLevel: 'PUBLIC_TO_EVERYONE',
        disabledComments: false,
        disabledDuet: false,
        disabledStitch: false,
        isBrandedContent: false,
        isYourBrand: true,
        isAiGenerated: true,
      };
    }
    return { targetType: normalized };
  }

  private async requireSetting(key: string, code: string): Promise<string> {
    const value = (await this.settings.get(key))?.trim();
    if (!value) throw new AppException(code, HttpStatus.BAD_REQUEST);
    return value;
  }

  private async call<T>(
    path: string,
    apiKey: string,
    opts: { method: 'GET' | 'POST'; body?: unknown },
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: opts.method,
      headers: {
        'Content-Type': 'application/json',
        'blotato-api-key': apiKey,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.logger.warn(`Blotato API ${path} failed: HTTP ${res.status} ${JSON.stringify(json).slice(0, 500)}`);
      throw new AppException('content.blotatoUnavailable', HttpStatus.BAD_GATEWAY);
    }
    return json as T;
  }
}
