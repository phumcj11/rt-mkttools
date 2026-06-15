import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignAssetKind, SignSize, SignType } from '../../../database/entities';

export class SignAssetInputDto {
  @IsIn(['product', 'current_sign', 'shelf', 'other'])
  kind: SignAssetKind;

  @IsString()
  @IsNotEmpty()
  dataUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalName?: string;
}

export class CreateSignRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  branchName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  requesterName: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  productName: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  promotion?: string;

  @IsIn(['price_tag', 'promotion', 'benefit_card', 'shelf_tag'])
  signType: SignType;

  @IsIn(['a5', 'a6', 'a7', 'shelf_tag'])
  signSize: SignSize;

  @IsOptional()
  @IsNumber()
  templateId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headline?: string;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignAssetInputDto)
  assets?: SignAssetInputDto[];

  /** ERP campaign ID (for promotion traceability) */
  @IsOptional()
  @IsNumber()
  erpCampaignId?: number;

  /** ERP campaign display name */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  erpCampaignName?: string;

  /** Human-readable promotion step text, e.g. "ซื้อ 2 ชิ้น ฿89" */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  erpStepText?: string;
}
