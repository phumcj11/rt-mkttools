import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RoleName } from '../../../database/entities';

const ROLE_VALUES: RoleName[] = ['owner', 'admin', 'editor', 'viewer'];

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
}
