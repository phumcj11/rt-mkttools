import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { CustomerMixSource } from '../../../database/entities/branch-customer-mix-daily.entity';
import type { TrafficSource } from '../../../database/entities/branch-traffic-daily.entity';

export class UpsertSalesTargetDto {
  @IsString()
  @MaxLength(7)
  yearMonth: string;

  @IsOptional()
  @IsInt()
  branchId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  branchCode?: string | null;

  @IsNumber()
  @Min(0)
  targetRevenue: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  targetTransactions?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAvgTicket?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class BulkUpsertTargetsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertSalesTargetDto)
  targets: UpsertSalesTargetDto[];
}

export class UpsertTrafficEntryDto {
  @IsInt()
  branchId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  branchCode?: string | null;

  @IsDateString()
  trafficDate: string;

  @IsInt()
  @Min(0)
  footTraffic: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  transactions?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string | null;

  @IsOptional()
  @IsEnum(['manual', 'import', 'camera'])
  source?: TrafficSource;
}

export class BulkUpsertTrafficDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertTrafficEntryDto)
  entries: UpsertTrafficEntryDto[];
}

export class UpsertCustomerMixEntryDto {
  @IsInt()
  branchId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  branchCode?: string | null;

  @IsDateString()
  mixDate: string;

  @IsString()
  @MaxLength(50)
  customerType: string;

  @IsInt()
  @Min(0)
  count: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pct?: number | null;

  @IsOptional()
  @IsEnum(['manual', 'import', 'estimate'])
  source?: CustomerMixSource;
}

export class BulkUpsertCustomerMixDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCustomerMixEntryDto)
  entries: UpsertCustomerMixEntryDto[];
}

export class UpdateActiveBranchesDto {
  @IsArray()
  @IsString({ each: true })
  codes: string[];
}

export class CreateStorefrontActivityDto {
  @IsInt()
  branchId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  branchCode?: string | null;

  @IsDateString()
  activityDate: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoDataUrls?: string[] | null;
}
