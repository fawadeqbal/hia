import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  SHIPPING_RATE_TYPES,
  type CourierInput,
  type ShippingDestination,
  type ShippingRateInput,
  type ShippingRateType,
  type ShippingZoneInput,
} from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const money = { maxDecimalPlaces: 2 };

/** Mirrors shippingRateRowSchema in @ecommerce/types. */
export class RateInputDto implements ShippingRateInput {
  @ApiPropertyOptional({ description: 'Existing rate id (update); omit to create' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) name: string;
  @ApiProperty({ enum: SHIPPING_RATE_TYPES })
  @IsIn([...SHIPPING_RATE_TYPES])
  type: ShippingRateType;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() courierId: string | null;
  @ApiProperty() @IsNumber(money) @Min(0) price: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(0) minWeightGrams:
    number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(0) maxWeightGrams:
    number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsNumber(money) @Min(0) minOrderTotal:
    number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsNumber(money) @Min(0) maxOrderTotal:
    number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsNumber(money) @Min(0) freeAbove:
    number | null;
  @ApiProperty() @IsBoolean() codAvailable: boolean;
  @ApiProperty() @IsNumber(money) @Min(0) codFee: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  estimatedDays: string | null;
  @ApiProperty() @IsBoolean() isActive: boolean;
}

export class CreateZoneDto implements ShippingZoneInput {
  @ApiProperty({ example: 'Karachi' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: ['PK'], description: 'ISO country codes; empty = everywhere' })
  @IsArray()
  @ArrayMaxSize(250)
  @Matches(/^[A-Z]{2}$/, { each: true, message: 'countries must be 2-letter codes' })
  countries: string[];

  @ApiProperty({
    example: ['Karachi'],
    description: 'Province / city names; empty = whole country',
  })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  regions: string[];

  @ApiProperty() @IsBoolean() isActive: boolean;

  @ApiProperty({ type: [RateInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RateInputDto)
  rates: RateInputDto[];
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}

export class CreateCourierDto implements CourierInput {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(60) name: string;
  @ApiProperty({ example: 'tcs' })
  @Transform(trim)
  @Matches(/^[a-z0-9-]{2,30}$/, { message: 'code: lowercase letters, numbers and hyphens' })
  code: string;
  @ApiPropertyOptional({ nullable: true, example: 'https://courier.example/track/{tracking}' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^https?:\/\/.*\{tracking\}/, { message: 'tracking link must contain {tracking}' })
  trackingUrlTemplate: string | null;
  @ApiProperty() @IsBoolean() isActive: boolean;
}

export class UpdateCourierDto extends PartialType(CreateCourierDto) {}

export class DestinationDto implements ShippingDestination {
  @ApiProperty({ example: 'PK' }) @Transform(trim) @Matches(/^[A-Za-z]{2}$/) countryCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) state?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string | null;
}
