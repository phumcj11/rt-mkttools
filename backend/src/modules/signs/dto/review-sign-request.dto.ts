import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { SignReviewDecision } from '../../../database/entities';

export class ReviewSignRequestDto {
  @IsIn(['approve', 'reject', 'need_more_info'])
  decision: SignReviewDecision;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsObject()
  editedFields?: Record<string, unknown>;
}
