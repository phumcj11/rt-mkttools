import { IsObject } from 'class-validator';

export class UpdateSignDraftDto {
  @IsObject()
  fields: Record<string, unknown>;
}
