import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { MAX_LINE_QUANTITY, type AddToCartInput, type UpdateCartItemInput } from '@ecommerce/types';

export class AddToCartDto implements AddToCartInput {
  @ApiProperty() @IsString() variantId: string;
  @ApiProperty({ minimum: 1, maximum: MAX_LINE_QUANTITY })
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity: number;
}

export class UpdateCartItemDto implements UpdateCartItemInput {
  @ApiProperty({ minimum: 0, maximum: MAX_LINE_QUANTITY, description: '0 removes the item' })
  @IsInt()
  @Min(0)
  @Max(MAX_LINE_QUANTITY)
  quantity: number;
}
