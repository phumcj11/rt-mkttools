import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsOptional()
  @IsInt()
  branchId?: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  author?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  text?: string;

  @IsString()
  @IsOptional()
  @IsIn(['positive', 'neutral', 'negative'])
  sentiment?: 'positive' | 'neutral' | 'negative';

  @IsString()
  @IsOptional()
  reviewDate?: string;
}
