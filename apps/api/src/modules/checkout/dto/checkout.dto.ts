import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { CheckoutQuoteInput, PaymentMethod, PlaceOrderInput } from '@ecommerce/types';

import { DestinationDto } from '../../shipping/dto/shipping.dto';
import { ShippingAddressDto } from '../../users/dto/address.dto';

/** Methods the storefront can request; availability is decided by CheckoutService.quote(). */
const CHECKOUT_METHODS: PaymentMethod[] = ['COD', 'CARD', 'WALLET', 'BANK_TRANSFER', 'GIFT_CARD'];

export class QuoteRequestDto implements CheckoutQuoteInput {
  @ApiPropertyOptional({ enum: CHECKOUT_METHODS })
  @IsOptional()
  @IsIn(CHECKOUT_METHODS)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Saved address id (signed-in customers)' })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({ type: DestinationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DestinationDto)
  destination?: DestinationDto;

  @ApiPropertyOptional({ description: '{ vendorId: shippingRateId }' })
  @IsOptional()
  @IsObject()
  shippingRateIds?: Record<string, string>;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string | null;

  @ApiPropertyOptional({ description: 'Use loyalty points (signed-in)' })
  @IsOptional()
  @IsBoolean()
  redeemPoints?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  giftCardCode?: string | null;

  @ApiPropertyOptional({ description: 'Guest email (per-customer coupon limits)' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class PlaceOrderDto implements PlaceOrderInput {
  @ApiPropertyOptional({ description: 'Required for guest checkout' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Saved address id (signed-in customers)' })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({ type: ShippingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  address?: ShippingAddressDto;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() saveAddress?: boolean;

  @ApiProperty({
    enum: CHECKOUT_METHODS,
    description: 'Online methods return a gateway page to pay on',
  })
  @IsIn(CHECKOUT_METHODS)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(500) customerNote?:
    string | null;

  @ApiPropertyOptional({ description: '{ vendorId: shippingRateId } — cheapest when omitted' })
  @IsOptional()
  @IsObject()
  shippingRateIds?: Record<string, string>;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string | null;

  @ApiPropertyOptional({ description: 'Use loyalty points (signed-in)' })
  @IsOptional()
  @IsBoolean()
  redeemPoints?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  giftCardCode?: string | null;

  @ApiProperty({ description: 'Random id per checkout attempt' })
  @IsString()
  @Length(8, 100)
  idempotencyKey: string;
}
