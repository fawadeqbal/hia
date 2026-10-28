import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MANUAL_MOVEMENT_TYPES,
  STOCK_ADJUST_MODES,
  STOCK_FILTERS,
  type ManualMovementType,
  type StockAdjustInput,
  type StockAdjustMode,
  type StockFilter,
  type WarehouseAddress,
  type WarehouseInput,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class WarehouseAddressDto implements WarehouseAddress {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) line1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

export class CreateWarehouseDto implements WarehouseInput {
  @ApiProperty({ example: 'Lahore warehouse' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiPropertyOptional({ example: 'LHR-1', description: 'Generated from the name when omitted' })
  @IsOptional()
  @Transform(upper)
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Z0-9-]+$/, { message: 'code may contain letters, numbers and hyphens only' })
  code?: string;

  @ApiPropertyOptional({ type: WarehouseAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WarehouseAddressDto)
  address?: WarehouseAddressDto;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}

export class StockQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Defaults to the main warehouse' })
  @IsOptional()
  @IsString()
  warehouseId?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ enum: STOCK_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(STOCK_FILTERS)
  filter?: StockFilter;
}

export class StockAdjustDto implements StockAdjustInput {
  @ApiProperty() @IsString() variantId: string;
  @ApiProperty() @IsString() warehouseId: string;
  @ApiProperty({ enum: STOCK_ADJUST_MODES }) @IsIn(STOCK_ADJUST_MODES) mode: StockAdjustMode;
  @ApiProperty() @IsInt() @Min(0) @Max(1_000_000) quantity: number;
  @ApiProperty({ enum: MANUAL_MOVEMENT_TYPES })
  @IsIn(MANUAL_MOVEMENT_TYPES)
  type: ManualMovementType;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(200) note?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100_000) lowStockThreshold?: number;
}

export class MovementQueryDto extends PaginationQueryDto {
  @ApiProperty() @IsString() variantId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() warehouseId?: string;
}

export class LowStockQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
}
