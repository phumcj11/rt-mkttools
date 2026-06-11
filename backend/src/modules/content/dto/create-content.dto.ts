import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContentType } from '../../../database/entities';

const TYPES: ContentType[] = ['caption', 'post', 'ad', 'line_broadcast', 'blog'];

export class CreateContentDto {
  @IsIn(TYPES)
  type: ContentType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsString()
  @MaxLength(20000)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  channel?: string;

  @IsOptional()
  @IsString()
  @IsIn(['th', 'en'])
  locale?: string;

  @IsOptional()
  @IsInt()
  aiRequestId?: number;
}
