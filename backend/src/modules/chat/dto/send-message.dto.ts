import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  threadId?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
