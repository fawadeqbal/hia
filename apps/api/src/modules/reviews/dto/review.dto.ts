import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MODERATION_STATUSES,
  type AnswerInput,
  type ModerateInput,
  type ModerationStatus,
  type QuestionInput,
  type ReviewInput,
  type VendorReplyInput,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ReviewQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MODERATION_STATUSES })
  @IsOptional()
  @IsIn([...MODERATION_STATUSES])
  status?: ModerationStatus;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
  @ApiPropertyOptional({ description: 'Questions without an answer' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unanswered?: boolean;
}

export class ReviewDtoIn implements ReviewInput {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  title?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  body?: string | null;
}

export class VendorReplyDto implements VendorReplyInput {
  @ApiProperty({ description: 'Empty removes the reply' })
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reply: string;
}

export class ModerateDto implements ModerateInput {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] }) @IsIn(['APPROVED', 'REJECTED']) status:
    'APPROVED' | 'REJECTED';
}

export class QuestionDtoIn implements QuestionInput {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @Transform(trim) @IsString() @MinLength(10) @MaxLength(500) body: string;
}

export class AnswerDtoIn implements AnswerInput {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(1000) body: string;
}
