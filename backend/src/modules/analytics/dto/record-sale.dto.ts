import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class RecordSaleDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number;

  @IsOptional()
  @IsString()
  soldAt?: string;
}
