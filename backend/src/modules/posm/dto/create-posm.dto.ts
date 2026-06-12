import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { PosmType } from '../../../database/entities';

const POSM_TYPES: PosmType[] = ['price_tag', 'shelf_talker', 'wobbler', 'promotion_a4', 'review_poster', 'sale_tag'];

export class CreatePosmDto {
  @IsIn(POSM_TYPES)
  type: PosmType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  productName: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  promotion?: string;
}
