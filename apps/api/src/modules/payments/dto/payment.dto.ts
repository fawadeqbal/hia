import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import {
  MOCK_PAYMENT_OUTCOMES,
  type MockPaymentCompleteInput,
  type MockPaymentOutcome,
  type StartPaymentInput,
} from '@ecommerce/types';

export class StartPaymentDto implements StartPaymentInput {
  @ApiPropertyOptional({ description: 'Guests: the email used at checkout' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email?: string;
}

export class MockCompleteDto implements MockPaymentCompleteInput {
  @ApiProperty({ enum: MOCK_PAYMENT_OUTCOMES })
  @IsIn([...MOCK_PAYMENT_OUTCOMES])
  outcome: MockPaymentOutcome;
}
