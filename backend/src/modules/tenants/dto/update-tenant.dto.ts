import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsString()
  @IsOptional()
  @IsIn(['th', 'en'])
  locale?: string;
}
