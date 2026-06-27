import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { getGoogleOAuthRedirectUri } from '../../common/utils/app-urls';
import { SystemSettingsService } from './system-settings.service';

class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  openai_api_key?: string;

  @IsOptional()
  @IsString()
  openai_model?: string;

  @IsOptional()
  @IsString()
  openai_max_tokens?: string;

  @IsOptional()
  @IsString()
  openai_temperature?: string;
}

class UpdateVideoSettingsDto {
  @IsOptional()
  @IsString()
  video_provider_default?: string;

  @IsOptional()
  @IsString()
  video_model_default?: string;

  @IsOptional()
  @IsString()
  gemini_api_key?: string;

  @IsOptional()
  @IsString()
  kling_api_key?: string;

  @IsOptional()
  @IsString()
  grok_api_key?: string;
}

class UpdateContentAutomationSettingsDto {
  @IsOptional()
  @IsString()
  manus_api_key?: string;

  @IsOptional()
  @IsString()
  manus_project_id?: string;

  @IsOptional()
  @IsString()
  manus_webhook_secret?: string;

  @IsOptional()
  @IsString()
  blotato_api_key?: string;

  @IsOptional()
  @IsString()
  blotato_account_id?: string;

  @IsOptional()
  @IsString()
  blotato_facebook_page_id?: string;
}

@Controller('settings/system')
export class SystemSettingsController {
  constructor(private readonly svc: SystemSettingsService) {}

  /** Returns public-safe view of settings (key masked, not full value) */
  @Get()
  async getSettings() {
    const all = await this.svc.getAll();
    const apiKey = all['openai_api_key'] ?? '';
    return {
      openai_configured: apiKey.length > 5,
      openai_model:      all['openai_model']       ?? 'gpt-4o-mini',
      openai_max_tokens: all['openai_max_tokens']  ?? '1024',
      openai_temperature: all['openai_temperature'] ?? '0.7',
      openai_key_preview: apiKey.length > 5
        ? `sk-...${apiKey.slice(-4)}`
        : null,
    };
  }

  @Patch('ai')
  @HttpCode(HttpStatus.OK)
  async updateAiSettings(@Body() dto: UpdateAiSettingsDto) {
    const allowed = [
      'openai_api_key',
      'openai_model',
      'openai_max_tokens',
      'openai_temperature',
    ] as const;
    for (const key of allowed) {
      const val = dto[key as keyof UpdateAiSettingsDto];
      if (val !== undefined) {
        await this.svc.set(key, val);
      }
    }
    return { ok: true };
  }

  @Get('google')
  async getGoogleSettings() {
    const clientId = (await this.svc.get('google_client_id')) ?? '';
    return {
      google_configured: clientId.length > 5,
      google_client_id_preview: clientId.length > 5 ? `...${clientId.slice(-6)}` : null,
      google_redirect_uri: getGoogleOAuthRedirectUri(),
    };
  }

  @Patch('google')
  @HttpCode(HttpStatus.OK)
  async updateGoogleSettings(
    @Body() body: { google_client_id?: string; google_client_secret?: string },
  ) {
    if (body.google_client_id !== undefined) {
      await this.svc.set('google_client_id', body.google_client_id);
    }
    if (body.google_client_secret !== undefined) {
      await this.svc.set('google_client_secret', body.google_client_secret);
    }
    return { ok: true };
  }

  // ────── Google Drive ──────

  @Get('drive')
  async getDriveSettings() {
    const folderId = (await this.svc.get('google_drive_folder_id')) ?? '';
    const saJson   = (await this.svc.get('google_service_account_json')) ?? '';
    const saReady = saJson.length > 20;
    const configured = folderId.length > 0 && saReady;
    return {
      drive_configured: configured,
      drive_folder_id_preview: folderId ? `...${folderId.slice(-8)}` : null,
      drive_service_account_set: saReady,
    };
  }

  @Patch('drive')
  @HttpCode(HttpStatus.OK)
  async updateDriveSettings(
    @Body() body: { google_drive_folder_id?: string; google_service_account_json?: string },
  ) {
    if (body.google_drive_folder_id !== undefined) {
      await this.svc.set('google_drive_folder_id', body.google_drive_folder_id);
    }
    if (body.google_service_account_json !== undefined) {
      await this.svc.set('google_service_account_json', body.google_service_account_json);
    }
    return { ok: true };
  }

  // ────── Video AI ──────

  @Get('video')
  async getVideoSettings() {
    const geminiKey = (await this.svc.get('gemini_api_key')) ?? '';
    const klingKey = (await this.svc.get('kling_api_key')) ?? '';
    const grokKey = (await this.svc.get('grok_api_key')) ?? '';
    const provider = (await this.svc.get('video_provider_default')) ?? 'gemini';
    const model = (await this.svc.get('video_model_default')) ?? 'veo-3.0-generate-preview';
    return {
      video_configured: [geminiKey, klingKey, grokKey].some((key) => key.length > 5),
      video_provider_default: provider,
      video_model_default: model,
      gemini_configured: geminiKey.length > 5,
      kling_configured: klingKey.length > 5,
      grok_configured: grokKey.length > 5,
      gemini_key_preview: geminiKey.length > 5 ? `...${geminiKey.slice(-4)}` : null,
      kling_key_preview: klingKey.length > 5 ? `...${klingKey.slice(-4)}` : null,
      grok_key_preview: grokKey.length > 5 ? `...${grokKey.slice(-4)}` : null,
    };
  }

  @Patch('video')
  @HttpCode(HttpStatus.OK)
  async updateVideoSettings(@Body() body: UpdateVideoSettingsDto) {
    const allowed = [
      'video_provider_default',
      'video_model_default',
      'gemini_api_key',
      'kling_api_key',
      'grok_api_key',
    ] as const;
    for (const key of allowed) {
      const val = body[key];
      if (val !== undefined) {
        await this.svc.set(key, val.trim());
      }
    }
    return { ok: true };
  }

  // ────── n8n Composite ──────

  @Get('n8n')
  async getN8nSettings() {
    const promoUrl = (await this.svc.get('n8n_promo_webhook_url')) ?? '';
    const signCutoutUrl = (await this.svc.get('n8n_sign_cutout_webhook_url')) ?? '';
    return {
      n8n_configured: promoUrl.startsWith('http'),
      n8n_webhook_url_preview: promoUrl ? `${promoUrl.slice(0, 30)}…` : null,
      n8n_promo_webhook_url: promoUrl,
      n8n_sign_cutout_webhook_url: signCutoutUrl,
    };
  }

  @Patch('n8n')
  @HttpCode(HttpStatus.OK)
  async updateN8nSettings(@Body() body: { n8n_promo_webhook_url?: string; n8n_sign_cutout_webhook_url?: string }) {
    if (body.n8n_promo_webhook_url !== undefined) {
      await this.svc.set('n8n_promo_webhook_url', body.n8n_promo_webhook_url.trim());
    }
    if (body.n8n_sign_cutout_webhook_url !== undefined) {
      await this.svc.set('n8n_sign_cutout_webhook_url', body.n8n_sign_cutout_webhook_url.trim());
    }
    return { ok: true };
  }

  // ────── Content Factory Automation: Manus + Blotato ──────

  @Get('content-automation')
  async getContentAutomationSettings() {
    const manusKey = (await this.svc.get('manus_api_key')) ?? '';
    const blotatoKey = (await this.svc.get('blotato_api_key')) ?? '';
    const projectId = (await this.svc.get('manus_project_id')) ?? '';
    const accountId = (await this.svc.get('blotato_account_id')) ?? '';
    const facebookPageId = (await this.svc.get('blotato_facebook_page_id')) ?? '';
    const missingManus = [
      !manusKey ? 'Manus API Key' : '',
      !projectId ? 'Manus Project ID' : '',
    ].filter(Boolean);
    const missingBlotato = [
      !blotatoKey ? 'Blotato API Key' : '',
      !accountId ? 'Blotato Account ID' : '',
    ].filter(Boolean);
    return {
      manus_configured: manusKey.length > 5 && projectId.length > 0,
      manus_key_preview: manusKey.length > 5 ? `...${manusKey.slice(-4)}` : null,
      manus_project_id: projectId,
      manus_missing: missingManus,
      manus_webhook_secret_set: ((await this.svc.get('manus_webhook_secret')) ?? '').length > 0,
      blotato_configured: blotatoKey.length > 5 && accountId.length > 0,
      blotato_key_preview: blotatoKey.length > 5 ? `...${blotatoKey.slice(-4)}` : null,
      blotato_account_id: accountId,
      blotato_facebook_page_id: facebookPageId,
      blotato_missing: missingBlotato,
    };
  }

  @Patch('content-automation')
  @HttpCode(HttpStatus.OK)
  async updateContentAutomationSettings(@Body() body: UpdateContentAutomationSettingsDto) {
    const allowed = [
      'manus_api_key',
      'manus_project_id',
      'manus_webhook_secret',
      'blotato_api_key',
      'blotato_account_id',
      'blotato_facebook_page_id',
    ] as const;
    for (const key of allowed) {
      const val = body[key];
      if (val !== undefined) {
        await this.svc.set(key, val.trim());
      }
    }
    return { ok: true };
  }

  @Get('content-automation/manus/test')
  async testManusProject() {
    const apiKey = ((await this.svc.get('manus_api_key')) ?? '').trim();
    const projectId = ((await this.svc.get('manus_project_id')) ?? '').trim();
    if (!apiKey || !projectId) {
      return { ok: false, message: 'ต้องมี Manus API Key และ Project ID ก่อน' };
    }
    const res = await fetch('https://api.manus.ai/v2/project.list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-manus-api-key': apiKey,
      },
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      return {
        ok: false,
        message: `Manus API ไม่สำเร็จ (HTTP ${res.status})`,
        details: json,
      };
    }
    const projects = Array.isArray(json.projects)
      ? json.projects
      : Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.items)
          ? json.items
          : [];
    const project = projects.find((p: Record<string, unknown>) => p.id === projectId);
    return {
      ok: !!project,
      message: project ? 'พบ Manus Project นี้แล้ว' : 'API key ใช้ได้ แต่ไม่พบ Project ID นี้',
      project: project ?? null,
      count: projects.length,
    };
  }

  @Get('content-automation/blotato/accounts')
  async getBlotatoAccounts() {
    const apiKey = ((await this.svc.get('blotato_api_key')) ?? '').trim();
    if (!apiKey) {
      return { ok: false, message: 'ต้องมี Blotato API Key ก่อน', accounts: [] };
    }
    const res = await fetch('https://backend.blotato.com/v2/users/me/accounts', {
      headers: {
        'Content-Type': 'application/json',
        'blotato-api-key': apiKey,
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        message: `Blotato API ไม่สำเร็จ (HTTP ${res.status})`,
        accounts: [],
        details: json,
      };
    }
    const accounts = Array.isArray(json.accounts)
      ? json.accounts
      : Array.isArray(json.data)
        ? json.data
        : Array.isArray(json)
          ? json
          : [];
    return { ok: true, message: `พบ ${accounts.length} accounts`, accounts };
  }
}
