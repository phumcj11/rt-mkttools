import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SignSize, SignType } from '../../../database/entities';

export class UploadTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsIn(['price_tag', 'promotion', 'benefit_card', 'shelf_tag'])
  signType?: SignType;

  @IsOptional()
  @IsIn(['a5', 'a6', 'a7', 'shelf_tag'])
  signSize?: SignSize;

  @IsString()
  @IsNotEmpty()
  dataUrl: string;
}
