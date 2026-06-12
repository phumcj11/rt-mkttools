import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
