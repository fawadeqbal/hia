import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  DISCOUNT_TYPES,
  PROMOTION_TYPES,
  normalizeCouponCode,
  type CouponInput,
  type DiscountType,
  type PromotionInput,
  type PromotionRules,
  type PromotionType,
} from '@ecommerce/types';

const money = { maxDecimalPlaces: 2 };

export class CouponDtoIn implements CouponInput {
  @ApiProperty({ example: 'SUMMER10' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeCouponCode(value) : value))
  @Matches(/^[A-Z0-9_-]{3,30}$/, { message: 'code: 3–30 letters, numbers, - or _' })
  code: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(200) description:
    string | null;
  @ApiProperty({ enum: DISCOUNT_TYPES }) @IsIn([...DISCOUNT_TYPES]) discountType: DiscountType;
  @ApiProperty() @IsNumber(money) @Min(0) value: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsNumber(money) @Min(0) minOrderTotal:
    number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsNumber(money) @Min(0) maxDiscount:
    number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) usageLimit: number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) usageLimitPerCustomer:
    number | null;
  @ApiProperty() @IsBoolean() stackable: boolean;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) categoryIds: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) productIds: string[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateString() startsAt: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateString() endsAt: string | null;
  @ApiProperty() @IsBoolean() isActive: boolean;
}

export class PromotionDtoIn implements PromotionInput {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name: string;
  @ApiProperty({ enum: PROMOTION_TYPES }) @IsIn([...PROMOTION_TYPES]) type: PromotionType;
  @ApiProperty({ description: 'Type-specific rules (see PromotionRules)' })
  @IsObject()
  rules: PromotionRules;
  @ApiProperty() @IsInt() @Min(-100) @Max(100) priority: number;
  @ApiProperty() @IsDateString() startsAt: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateString() endsAt: string | null;
  @ApiProperty() @IsBoolean() isActive: boolean;
}
