import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { DATE_KEY_REGEX, type ReportRangeQuery } from '@ecommerce/types';

export class ReportQueryDto implements ReportRangeQuery {
  @ApiPropertyOptional({
    example: '2026-09-13',
    description: 'Inclusive, store time zone. Default: 30 days ago.',
  })
  @IsOptional()
  @Matches(DATE_KEY_REGEX, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-12',
    description: 'Inclusive, store time zone. Default: today.',
  })
  @IsOptional()
  @Matches(DATE_KEY_REGEX, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}
