import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RoleName, UserStatus } from '../../../database/entities';

const ROLE_VALUES: RoleName[] = ['owner', 'admin', 'editor', 'viewer'];
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
}
