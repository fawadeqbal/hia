import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { FaqInput } from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Mirrors faqFormSchema. */
export class CreateFaqDto implements FaqInput {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, 300)
  question: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, 5000)
  answer: string;

  @ApiPropertyOptional({ nullable: true, example: 'Orders' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  position?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFaqDto extends PartialType(CreateFaqDto) {}
