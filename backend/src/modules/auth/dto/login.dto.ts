import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(190)
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}
