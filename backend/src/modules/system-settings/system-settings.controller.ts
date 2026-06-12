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
    const configured = folderId.length > 0 && saJson.length > 20;
    return {
      drive_configured: configured,
      drive_folder_id_preview: folderId ? `...${folderId.slice(-8)}` : null,
      drive_service_account_set: saJson.length > 20,
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

  // ────── Video (Kling AI) ──────

  @Get('video')
  async getVideoSettings() {
    const key = (await this.svc.get('kling_api_key')) ?? '';
    return {
      video_configured: key.length > 5,
      kling_key_preview: key.length > 5 ? `...${key.slice(-4)}` : null,
    };
  }

  @Patch('video')
  @HttpCode(HttpStatus.OK)
  async updateVideoSettings(@Body() body: { kling_api_key?: string }) {
    if (body.kling_api_key !== undefined) {
      await this.svc.set('kling_api_key', body.kling_api_key);
    }
    return { ok: true };
  }
}
