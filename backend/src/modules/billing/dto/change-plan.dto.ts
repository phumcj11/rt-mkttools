import { IsIn, IsString } from 'class-validator';
import { PlanCode } from '../../../database/entities/plan.entity';

const PLAN_CODES: PlanCode[] = ['free', 'pro', 'business'];

export class ChangePlanDto {
  @IsString()
  @IsIn(PLAN_CODES)
  planCode: PlanCode;
}
