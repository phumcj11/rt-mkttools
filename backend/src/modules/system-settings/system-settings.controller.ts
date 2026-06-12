import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
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
}
