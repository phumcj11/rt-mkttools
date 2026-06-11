import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type PaymentMethod = 'manual' | 'bank_transfer' | 'promptpay';

export class PayInvoiceDto {
  @IsIn(['manual', 'bank_transfer', 'promptpay'])
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentReference?: string;
}
