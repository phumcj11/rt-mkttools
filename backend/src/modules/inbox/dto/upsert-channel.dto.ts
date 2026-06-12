import { IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ChannelType } from '../../../database/entities';

const CHANNEL_TYPES: ChannelType[] = ['line', 'facebook', 'whatsapp', 'webchat'];

export class UpsertChannelDto {
  @IsIn(CHANNEL_TYPES)
  channel: ChannelType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  pageId: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  pageName?: string;

  @IsObject()
  credentials: Record<string, string>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
