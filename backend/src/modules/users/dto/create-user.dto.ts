import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RoleName } from '../../../database/entities';

const ROLE_VALUES: RoleName[] = [
  'super_admin',
  'admin',
  'marketing_manager',
  'marketing_staff',
  'branch_manager',
  'customer_service',
];

export class CreateUserDto {
  @IsEmail()
  @MaxLength(190)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  fullName?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ROLE_VALUES, { each: true })
  roles: RoleName[];

  @IsOptional()
  @IsInt()
  @IsPositive()
  branchId?: number;
}
