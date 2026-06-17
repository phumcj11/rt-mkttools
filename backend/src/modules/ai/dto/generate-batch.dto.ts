import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { GENERATE_CONTENT_TYPES } from '../../content/content-types';
import { ContentTone } from '../templates';

const TONES: ContentTone[] = ['friendly', 'fun', 'professional', 'urgent'];

export class BatchProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  productName: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  campaignName?: string;
}

export class GenerateBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BatchProductDto)
  products: BatchProductDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(GENERATE_CONTENT_TYPES, { each: true })
  types: (typeof GENERATE_CONTENT_TYPES)[number][];

  @IsOptional()
  @IsIn(TONES)
  tone?: ContentTone;

  @IsOptional()
  @IsIn(['th', 'en'])
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  campaignName?: string;
}
