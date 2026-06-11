import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { RoleName, UserStatus } from '../../../database/entities';

const ROLE_VALUES: RoleName[] = [
  'super_admin',
  'admin',
  'marketing_manager',
  'marketing_staff',
  'branch_manager',
  'customer_service',
];
const STATUS_VALUES: UserStatus[] = ['active', 'invited', 'disabled'];

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  fullName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  locale?: string;

  @IsOptional()
  @IsIn(STATUS_VALUES)
  status?: UserStatus;

  @IsOptional()
  @IsArray()
  @IsIn(ROLE_VALUES, { each: true })
  roles?: RoleName[];

  @IsOptional()
  @IsInt()
  @IsPositive()
  branchId?: number | null;
}
