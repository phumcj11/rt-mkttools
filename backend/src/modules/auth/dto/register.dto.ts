import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  shopName: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  fullName?: string;

  @IsEmail()
  @MaxLength(190)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
