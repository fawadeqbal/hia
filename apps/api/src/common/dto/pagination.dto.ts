import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Paginated } from '@ecommerce/types';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  get skip() {
    return (this.page - 1) * this.limit;
  }
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
