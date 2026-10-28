import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_STATUSES,
  type BlockCustomerInput,
  type CustomerListQuery,
  type CustomerSegment,
  type CustomerStatus,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CustomerQueryDto extends PaginationQueryDto implements CustomerListQuery {
  @ApiPropertyOptional({ description: 'Name, email or phone' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_SEGMENTS })
  @IsOptional()
  @IsIn([...CUSTOMER_SEGMENTS])
  segment?: CustomerSegment;

  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES })
  @IsOptional()
  @IsIn([...CUSTOMER_STATUSES])
  status?: CustomerStatus;
}

export class BlockCustomerDto implements BlockCustomerInput {
  @ApiProperty({ example: 'Repeated fraudulent COD orders' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(5, 500)
  reason: string;
}
