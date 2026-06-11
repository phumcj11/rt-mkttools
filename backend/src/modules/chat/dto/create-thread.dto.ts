import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateThreadDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
