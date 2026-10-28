import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STOREFRONT_SORTS, type StorefrontSort } from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const PRODUCT_SORTS = STOREFRONT_SORTS;
export type ProductSort = StorefrontSort;

/** Public storefront listing query. */
export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search in product names' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Category slug (includes subcategories)' })
  @IsOptional()
  @IsString()
  category?: string;
  @ApiPropertyOptional({ description: 'Brand slug' }) @IsOptional() @IsString() brand?: string;
  @ApiPropertyOptional({ description: 'Vendor slug' }) @IsOptional() @IsString() vendor?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @ApiPropertyOptional({ enum: PRODUCT_SORTS })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ description: 'Only discounted products (compare-at price above price)' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  onSale?: boolean;

  @ApiPropertyOptional({ description: 'Comma-separated attribute value ids' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  values?: string;
}
