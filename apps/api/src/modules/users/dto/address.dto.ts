import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import type { AddressInput, ShippingAddress } from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** Mirrors addressFields in @ecommerce/types. */
export class ShippingAddressDto implements ShippingAddress {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100) fullName: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(7, 20)
  @Matches(/^[+0-9 ()-]+$/)
  phone: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(3, 200) line1: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(200) line2?:
    | string
    | null;
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 80) city: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(80) state?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(20) postalCode?:
    | string
    | null;
  @ApiProperty({ example: 'PK' }) @Transform(upper) @IsString() @Length(2, 2) countryCode: string;
}

export class CreateAddressDto extends ShippingAddressDto implements AddressInput {
  @ApiPropertyOptional({ nullable: true, example: 'Home' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
