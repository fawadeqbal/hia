import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { REWARD_KINDS, type RewardActivityQuery, type RewardKind } from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RewardActivityQueryDto extends PaginationQueryDto implements RewardActivityQuery {
  @ApiPropertyOptional({ enum: REWARD_KINDS })
  @IsOptional()
  @IsIn([...REWARD_KINDS])
  kind?: RewardKind;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) type?: string;

  @ApiPropertyOptional({ description: 'Customer, order number or code' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(DATE)
  to?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() userId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() couponId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() giftCardId?: string;
}

export class RewardSummaryQueryDto {
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) from?: string;

  @ApiPropertyOptional() @IsOptional() @Matches(DATE) to?: string;
}
