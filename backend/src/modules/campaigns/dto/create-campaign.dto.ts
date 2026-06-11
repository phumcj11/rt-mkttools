import { IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength, Matches, MinLength } from 'class-validator';
import { CampaignStatus } from '../../../database/entities';

const STATUS: CampaignStatus[] = ['draft', 'scheduled', 'running', 'completed', 'archived'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  objective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  channel?: string;

  @IsOptional()
  @IsIn(STATUS)
  status?: CampaignStatus;

  @IsOptional()
  @Matches(DATE_RE, { message: 'startDate ต้องเป็นรูปแบบ YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: 'endDate ต้องเป็นรูปแบบ YYYY-MM-DD' })
  endDate?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  branchId?: number;
}
