import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  EMAIL_LOG_STATUSES,
  type EmailLogStatus,
  type EmailTemplateInput,
  type EmailTemplateOverrides,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class OverridesDto implements EmailTemplateOverrides {
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(200) heading?:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(6000) body?:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(60) ctaLabel?:
    string | null;
}

export class EmailTemplateBody implements EmailTemplateInput {
  @ApiPropertyOptional({ nullable: true, description: 'null / empty = default subject' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject: string | null;

  @ApiProperty({ type: OverridesDto })
  @ValidateNested()
  @Type(() => OverridesDto)
  overrides: OverridesDto;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

export class EmailAddressDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class EmailLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EMAIL_LOG_STATUSES })
  @IsOptional()
  @IsIn(EMAIL_LOG_STATUSES)
  status?: EmailLogStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) template?: string;

  @ApiPropertyOptional({ description: 'Recipient contains' })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  search?: string;
}
