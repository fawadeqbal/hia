import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  COMMISSION_SCOPES,
  type CommissionPreviewQuery,
  type CommissionRuleInput,
  type CommissionScopeValue,
} from '@ecommerce/types';

export class CommissionRuleDtoIn implements CommissionRuleInput {
  @ApiProperty({ enum: COMMISSION_SCOPES })
  @IsIn([...COMMISSION_SCOPES])
  scope: CommissionScopeValue;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  vendorId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiProperty({ description: 'Percentage, 0–100' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCommissionRuleDto implements Partial<CommissionRuleInput> {
  @ApiPropertyOptional({ enum: COMMISSION_SCOPES })
  @IsOptional()
  @IsIn([...COMMISSION_SCOPES])
  scope?: CommissionScopeValue;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  vendorId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CommissionPreviewQueryDto implements CommissionPreviewQuery {
  @ApiProperty() @IsString() vendorId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
}
