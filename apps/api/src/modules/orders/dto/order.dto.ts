import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import {
  ORDER_REASON_MIN,
  type CancelOrderInput,
  type OrderStatus,
  type TrackOrderInput,
  type VendorOrderStatusInput,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const ORDER_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'COD_CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUNDED',
];

export class OrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;
  @ApiPropertyOptional({ description: 'Order number, email or customer name' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CancelOrderDto implements CancelOrderInput {
  @ApiProperty({ minLength: ORDER_REASON_MIN })
  @Transform(trim)
  @IsString()
  @Length(ORDER_REASON_MIN, 500)
  reason: string;
}

export class TrackOrderDto implements TrackOrderInput {
  @ApiProperty({ example: 'ORD-261011-7K2QX' })
  @Transform(trim)
  @IsString()
  @Length(5, 40)
  orderNumber: string;
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;
}

export class VendorOrderStatusDto implements VendorOrderStatusInput {
  @ApiProperty({ enum: ORDER_STATUSES }) @IsIn(ORDER_STATUSES) status: OrderStatus;
  @ApiPropertyOptional({ description: 'Required when shipping' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;
  @ApiPropertyOptional({ description: 'Courier carrying the parcel (when shipping)' })
  @IsOptional()
  @IsString()
  courierId?: string;
  @ApiPropertyOptional({ description: 'Required when cancelling' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}
