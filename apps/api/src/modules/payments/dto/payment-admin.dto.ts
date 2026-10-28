import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PaymentMethod,
  PaymentStatus,
  WEBHOOK_LOG_STATUSES,
  type PaymentGatewayInput,
  type WebhookLogStatus,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const METHODS = Object.values(PaymentMethod);
const STATUSES = Object.values(PaymentStatus);

export class SaveGatewayDto implements PaymentGatewayInput {
  @ApiProperty()
  @IsBoolean()
  isEnabled: boolean;

  @ApiProperty()
  @IsBoolean()
  isTestMode: boolean;

  @ApiProperty({ enum: METHODS, isArray: true })
  @IsArray()
  @IsIn(METHODS, { each: true })
  methods: PaymentMethod[];

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(99)
  position: number;

  @ApiPropertyOptional({
    description: "Fields to change; '' clears one; omitted fields keep their value",
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}

export class PaymentLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: METHODS })
  @IsOptional()
  @IsIn(METHODS)
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Order number or gateway reference' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class WebhookLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WEBHOOK_LOG_STATUSES })
  @IsOptional()
  @IsIn(WEBHOOK_LOG_STATUSES)
  status?: WebhookLogStatus;

  @ApiPropertyOptional({ description: 'Event id, type or gateway' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
