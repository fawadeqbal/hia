import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_LINE_QUANTITY, type ManualOrderInput } from '@ecommerce/types';
import { ShippingAddressDto } from '../../users/dto/address.dto';

export class ManualOrderItemDto {
  @ApiProperty() @IsString() variantId: string;
  @ApiProperty() @IsInt() @Min(1) @Max(MAX_LINE_QUANTITY) quantity: number;
}

export class ManualOrderDto implements ManualOrderInput {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({ type: [ManualOrderItemDto] })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ManualOrderItemDto)
  items: ManualOrderItemDto[];

  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  address: ShippingAddressDto;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) customerNote?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) staffNote?: string | null;
}
