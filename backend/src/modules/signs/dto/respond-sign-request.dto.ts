import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignAssetInputDto } from './create-sign-request.dto';

export class RespondSignRequestDto {
  @IsString()
  note: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignAssetInputDto)
  assets?: SignAssetInputDto[];
}
