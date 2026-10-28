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
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MAX_PRODUCT_IMAGES,
  MAX_VARIANTS,
  PRODUCT_REASON_MIN,
  PRODUCT_STATUSES,
  SKU_REGEX,
  SLUG_REGEX,
  type ProductFeatureInput,
  type ProductImageInput,
  type ProductInput,
  type ProductRejectInput,
  type ProductSpec,
  type ProductStatus,
  type ProductVariantInput,
  type ProductVariantsInput,
  TAX_CLASSES,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const URL_OPTIONS = { require_tld: false, protocols: ['http', 'https'], require_protocol: true };
const MONEY = { maxDecimalPlaces: 2 };

export class ProductSpecDto implements ProductSpec {
  @ApiProperty({ example: 'Screen size' })
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  label: string;
  @ApiProperty({ example: '6.8 inch' }) @Transform(trim) @IsString() @Length(1, 300) value: string;
}

export class ProductImageInputDto implements ProductImageInput {
  @ApiProperty() @IsUrl(URL_OPTIONS) url: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(200) altText?:
    string | null;
}

/** Mirrors productFormSchema in @ecommerce/types. */
export class CreateProductDto implements ProductInput {
  @ApiProperty({ example: 'Galaxy S24 Ultra 256GB' })
  @Transform(trim)
  @IsString()
  @Length(3, 200)
  name: string;

  @ApiPropertyOptional({ description: 'Generated from name when omitted' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(140)
  @Matches(SLUG_REGEX, { message: 'slug may contain lowercase letters, numbers and hyphens only' })
  slug?: string;

  @ApiProperty() @IsString() categoryId: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() brandId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string | null;

  @ApiPropertyOptional({ type: [ProductSpecDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProductSpecDto)
  specifications?: ProductSpecDto[];

  @ApiProperty({ example: 1299.99 }) @IsNumber(MONEY) @Min(0.01) @Max(99_999_999) basePrice: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Original price shown struck through; must exceed basePrice',
  })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(99_999_999)
  compareAtPrice?: number | null;

  @ApiProperty({ example: 'SAM-S24U-256-BLK' })
  @Transform(trim)
  @IsString()
  @Length(2, 64)
  @Matches(SKU_REGEX, {
    message: 'sku may contain letters, numbers, dot, dash and underscore only',
  })
  sku: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9_999_999)
  weightGrams?: number | null;

  @ApiPropertyOptional({ enum: TAX_CLASSES, nullable: true, description: 'Null = standard' })
  @IsOptional()
  @IsIn(TAX_CLASSES)
  taxClass?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUrl(URL_OPTIONS) videoUrl?:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(70) seoTitle?:
    string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string | null;

  @ApiPropertyOptional({ type: [ProductImageInputDto], description: 'Ordered; first = main image' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_IMAGES)
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductVariantInputDto implements ProductVariantInput {
  @ApiPropertyOptional() @IsOptional() @IsString() id?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, 64)
  @Matches(SKU_REGEX, {
    message: 'sku may contain letters, numbers, dot, dash and underscore only',
  })
  sku: string;

  @ApiProperty() @IsNumber(MONEY) @Min(0.01) @Max(99_999_999) price: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(99_999_999)
  compareAtPrice?: number | null;
  @ApiProperty() @IsBoolean() isActive: boolean;

  @ApiProperty({
    type: [String],
    description: 'One attribute value id per attribute; [] for a simple product',
  })
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  valueIds: string[];
}

export class SaveVariantsDto implements ProductVariantsInput {
  @ApiProperty({ type: [ProductVariantInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_VARIANTS)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantInputDto)
  variants: ProductVariantInputDto[];
}

export class RejectProductDto implements ProductRejectInput {
  @ApiProperty({ minLength: PRODUCT_REASON_MIN })
  @Transform(trim)
  @IsString()
  @Length(PRODUCT_REASON_MIN, 1000)
  reason: string;
}

export class FeatureProductDto implements ProductFeatureInput {
  @ApiProperty() @IsBoolean() isFeatured: boolean;
}

export class ManageProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PRODUCT_STATUSES })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatus;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional({ description: 'Admin only' }) @IsOptional() @IsString() vendorId?: string;
}
