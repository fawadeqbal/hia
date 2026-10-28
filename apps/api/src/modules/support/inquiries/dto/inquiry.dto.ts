import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import {
  INQUIRY_MESSAGE_MAX,
  INQUIRY_MESSAGE_MIN,
  INQUIRY_STATUSES,
  INQUIRY_TOPICS,
  PHONE_PATTERN,
  type InquiryInput,
  type InquiryNoteInput,
  type InquiryStatus,
  type InquiryStatusInput,
  type InquiryTopic,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Mirrors inquiryFormSchema (packages/types/src/schemas/inquiry.schema.ts). */
export class CreateInquiryDto implements InquiryInput {
  @ApiProperty({ enum: INQUIRY_TOPICS })
  @IsIn([...INQUIRY_TOPICS])
  topic: InquiryTopic;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '0300 1234567' })
  @Transform(trim)
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'Enter a valid phone number' })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== '' && v !== null)
  @IsEmail({}, { message: 'Enter a valid email' })
  @MaxLength(200)
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  company?: string | null;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(INQUIRY_MESSAGE_MIN)
  @MaxLength(INQUIRY_MESSAGE_MAX)
  message: string;
}

export class InquiryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: INQUIRY_STATUSES })
  @IsOptional()
  @IsIn([...INQUIRY_STATUSES])
  status?: InquiryStatus;

  @ApiPropertyOptional({ enum: INQUIRY_TOPICS })
  @IsOptional()
  @IsIn([...INQUIRY_TOPICS])
  topic?: InquiryTopic;

  @ApiPropertyOptional({ description: 'Number, name, phone or email' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class InquiryStatusDto implements InquiryStatusInput {
  @ApiProperty({ enum: INQUIRY_STATUSES })
  @IsIn([...INQUIRY_STATUSES])
  status: InquiryStatus;
}

export class InquiryNoteDto implements InquiryNoteInput {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  body: string;
}
