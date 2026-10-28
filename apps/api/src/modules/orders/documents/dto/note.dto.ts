import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { ORDER_NOTE_MAX, type OrderNoteInput } from '@ecommerce/types';

export class OrderNoteDtoBody implements OrderNoteInput {
  @ApiProperty()
  @IsString()
  @Length(1, ORDER_NOTE_MAX)
  content: string;

  @ApiProperty()
  @IsBoolean()
  isCustomerVisible: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Admin only' })
  @IsOptional()
  @IsString()
  vendorOrderId?: string | null;
}
