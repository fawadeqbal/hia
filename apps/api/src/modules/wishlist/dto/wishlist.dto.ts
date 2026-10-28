import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import type { StockAlertInput, WishlistAddInput } from '@ecommerce/types';

export class WishlistAddDto implements WishlistAddInput {
  @ApiProperty() @IsString() productId: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() variantId?: string | null;
}

export class StockAlertDto implements StockAlertInput {
  @ApiProperty() @IsString() variantId: string;
  @ApiPropertyOptional({ description: 'Guests only' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email?: string;
}
