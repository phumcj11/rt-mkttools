import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { GENERATE_CONTENT_TYPES } from '../../content/content-types';
import { ContentTone } from '../templates';

const TONES: ContentTone[] = ['friendly', 'fun', 'professional', 'urgent'];

export class GenerateContentDto {
  @IsIn(GENERATE_CONTENT_TYPES)
  type: (typeof GENERATE_CONTENT_TYPES)[number];

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
  @IsIn(TONES)
  tone?: ContentTone;

  @IsOptional()
  @IsIn(['th', 'en'])
  locale?: string;
}
