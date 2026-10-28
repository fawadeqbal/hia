import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  RETURN_REASONS,
  RETURN_STATUSES,
  type CreateReturnInput,
  type ReceiveReturnInput,
  type RefundReturnInput,
  type ReturnDecisionInput,
  type ReturnReason,
  type ReturnStatus,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ReturnQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RETURN_STATUSES })
  @IsOptional()
  @IsIn([...RETURN_STATUSES])
  status?: ReturnStatus;
  @ApiPropertyOptional({ description: 'RMA or order number' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  search?: string;
}

export class ReturnLineDto {
  @ApiProperty() @IsString() orderItemId: string;
  @ApiProperty() @IsInt() @Min(1) quantity: number;
}

export class CreateReturnDto implements CreateReturnInput {
  @ApiProperty() @Transform(trim) @IsString() orderNumber: string;
  @ApiProperty() @IsString() vendorOrderId: string;
  @ApiProperty({ type: [ReturnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items: ReturnLineDto[];
  @ApiProperty({ enum: RETURN_REASONS }) @IsIn([...RETURN_REASONS]) reason: ReturnReason;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  comments?: string | null;
}

export class ReturnDecisionDto implements ReturnDecisionInput {
  @ApiPropertyOptional({ description: 'Required to reject' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReceiveLineDto {
  @ApiProperty() @IsString() returnItemId: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  condition?: string | null;
  @ApiProperty() @IsBoolean() restock: boolean;
}

export class ReceiveReturnDto implements ReceiveReturnInput {
  @ApiProperty({ type: [ReceiveLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  items: ReceiveLineDto[];
}

export class RefundReturnDto implements RefundReturnInput {
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @ApiPropertyOptional({ description: 'COD: bank transfer / receipt reference' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  reference?: string;
}
