import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DiscountType } from '../../../database/entities';

const DISCOUNT_TYPES: DiscountType[] = ['percent', 'amount', 'bundle'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePromotionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number;

  @IsOptional()
  @IsIn(DISCOUNT_TYPES)
  discountType?: DiscountType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @Matches(DATE_RE, { message: 'startDate ต้องเป็นรูปแบบ YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: 'endDate ต้องเป็นรูปแบบ YYYY-MM-DD' })
  endDate?: string;
}
