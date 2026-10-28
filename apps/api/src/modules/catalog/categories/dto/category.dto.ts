import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { SLUG_REGEX, type CategoryInput } from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Mirrors categoryFormSchema in @ecommerce/types (used by the admin form). */
export class CreateCategoryDto implements CategoryInput {
  @ApiProperty({ example: 'Smartphones' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiPropertyOptional({ example: 'smartphones', description: 'Generated from name when omitted' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(140)
  @Matches(SLUG_REGEX, { message: 'slug may contain lowercase letters, numbers and hyphens only' })
  slug?: string;

  @ApiPropertyOptional({ nullable: true, description: 'null = top-level category' })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  imageUrl?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string | null;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
