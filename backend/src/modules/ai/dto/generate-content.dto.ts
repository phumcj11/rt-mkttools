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
import { ContentTone, GenerateContentType } from '../templates';

const TYPES: GenerateContentType[] = ['caption', 'post', 'ad', 'line_broadcast'];
const TONES: ContentTone[] = ['friendly', 'fun', 'professional', 'urgent'];

export class GenerateContentDto {
  @IsIn(TYPES)
  type: GenerateContentType;

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
  @MaxLength(1000)
  details?: string;

  @IsOptional()
  @IsIn(TONES)
  tone?: ContentTone;

  @IsOptional()
  @IsIn(['th', 'en'])
  locale?: string;
}
