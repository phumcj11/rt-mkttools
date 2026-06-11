import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BranchStatus } from '../../../database/entities/branch.entity';

const STATUS: BranchStatus[] = ['active', 'inactive'];

export class CreateBranchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsIn(STATUS)
  status?: BranchStatus;
}
