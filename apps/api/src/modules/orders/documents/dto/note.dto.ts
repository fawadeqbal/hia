import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, Length } from 'class-validator';
import { ORDER_NOTE_MAX, type OrderNoteInput } from '@ecommerce/types';

export class OrderNoteDtoBody implements OrderNoteInput {
  @ApiProperty()
  @IsString()
  @Length(1, ORDER_NOTE_MAX)
  content: string;

  @ApiProperty()
  @IsBoolean()
  isCustomerVisible: boolean;
}
