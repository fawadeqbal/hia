import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { SLUG_REGEX, type BrandInput } from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Mirrors brandFormSchema in @ecommerce/types (used by the admin form). */
export class CreateBrandDto implements BrandInput {
  @ApiProperty({ example: 'Samsung' })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({ example: 'samsung', description: 'Generated from name when omitted' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(140)
  @Matches(SLUG_REGEX, { message: 'slug may contain lowercase letters, numbers and hyphens only' })
  slug?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  logoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}
