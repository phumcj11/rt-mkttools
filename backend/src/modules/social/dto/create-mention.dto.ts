import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMentionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  platform: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  keyword: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  authorHandle?: string;

  @IsString()
  @IsOptional()
  @IsIn(['positive', 'neutral', 'negative'])
  sentiment?: 'positive' | 'neutral' | 'negative';

  @IsBoolean()
  @IsOptional()
  isViral?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  sourceUrl?: string;

  @IsString()
  @IsOptional()
  publishedAt?: string;
}
