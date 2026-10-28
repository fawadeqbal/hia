import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TAX_CLASSES,
  type CurrencyInput,
  type LanguageInput,
  type TaxClass,
  type TaxRateInput,
} from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class TaxRateDto implements TaxRateInput {
  @ApiProperty({ example: 'GST' })
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name: string;

  @ApiProperty({ enum: TAX_CLASSES })
  @IsIn(TAX_CLASSES)
  taxClass: TaxClass;

  @ApiProperty({ example: 'PK' })
  @Transform(upper)
  @Matches(/^[A-Z]{2}$/, { message: 'countryCode must be a two-letter code' })
  countryCode: string;

  @ApiPropertyOptional({ nullable: true, example: 'Punjab' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  region: string | null;

  @ApiProperty({ example: 18, description: 'Percent' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate: number;

  @ApiProperty()
  @IsBoolean()
  isInclusive: boolean;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

export class CurrencyDto implements CurrencyInput {
  @ApiPropertyOptional({ example: 'EUR', description: 'Only when creating' })
  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'code must be a three-letter code' })
  code?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 8)
  symbol: string;

  @ApiProperty({ example: 280, description: 'Units per 1 store-currency unit' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsPositive()
  @Max(1_000_000)
  exchangeRate: number;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

export class LanguageDto implements LanguageInput {
  @ApiPropertyOptional({ example: 'ur', description: 'Only when creating' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/, { message: 'code must look like ur or en-GB' })
  code?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name: string;

  @ApiProperty()
  @IsBoolean()
  isRtl: boolean;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}
