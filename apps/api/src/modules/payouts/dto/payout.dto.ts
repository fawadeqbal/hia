import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PAYOUT_STATUSES, type MarkPayoutInput, type PayoutStatus } from '@ecommerce/types';

export class PayoutQueryDto {
  @ApiPropertyOptional({ enum: PAYOUT_STATUSES })
  @IsOptional()
  @IsIn([...PAYOUT_STATUSES])
  status?: PayoutStatus;
}

export class MarkPayoutDto implements MarkPayoutInput {
  @ApiProperty({ enum: ['PROCESSING', 'PAID', 'FAILED'] })
  @IsIn(['PROCESSING', 'PAID', 'FAILED'])
  status: 'PROCESSING' | 'PAID' | 'FAILED';
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(100) reference?: string;
}
