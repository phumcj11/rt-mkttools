import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ALL_CONTENT_TYPES } from '../content-types';

export class CreateContentDto {
  @IsIn(ALL_CONTENT_TYPES as unknown as string[])
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsString()
  @MaxLength(20000)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  channel?: string;

  @IsOptional()
  @IsString()
  @IsIn(['th', 'en'])
  locale?: string;

  @IsOptional()
  @IsInt()
  aiRequestId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  campaignName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  productName?: string;
}

export class UpdateContentStatusDto {
  @IsIn(['draft', 'approved', 'scheduled', 'published'])
  status: 'draft' | 'approved' | 'scheduled' | 'published';
}

export class ScheduleContentDto {
  @IsISO8601()
  scheduledAt: string;
}

export class PublishLineDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lineUserId?: string;
}
