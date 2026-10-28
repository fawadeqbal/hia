import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CAMPAIGN_AUDIENCES,
  CUSTOMER_SEGMENTS,
  LINK_REGEX,
  SUBSCRIBER_STATUSES,
  type CampaignAudience,
  type CampaignContent,
  type CampaignInput,
  type CustomerSegment,
  type SubscriberStatus,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class EmailDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class SignedEmailDto extends EmailDto {
  @ApiProperty()
  @IsString()
  @Length(10, 64)
  sig: string;
}

export class CampaignContentDto implements CampaignContent {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  heading: string;

  @ApiProperty()
  @IsString()
  @Length(10, 10_000)
  body: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaLabel: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o: CampaignContentDto) => o.ctaUrl !== null && o.ctaUrl !== '')
  @Matches(LINK_REGEX, { message: 'ctaUrl must be a site path or a full https link' })
  ctaUrl: string | null;
}

export class CampaignDtoBody implements CampaignInput {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(3, 150)
  subject: string;

  @ApiProperty({ type: CampaignContentDto })
  @ValidateNested()
  @Type(() => CampaignContentDto)
  content: CampaignContentDto;

  @ApiProperty({ enum: CAMPAIGN_AUDIENCES })
  @IsIn(CAMPAIGN_AUDIENCES)
  audience: CampaignAudience;

  @ApiPropertyOptional({ enum: CUSTOMER_SEGMENTS, nullable: true })
  @IsOptional()
  @IsIn(CUSTOMER_SEGMENTS)
  segment: CustomerSegment | null;
}

export class ScheduleDto {
  @ApiPropertyOptional({ nullable: true, description: 'null = send now' })
  @IsOptional()
  @IsDateString()
  scheduledAt: string | null;
}

export class AudienceQueryDto {
  @ApiProperty({ enum: CAMPAIGN_AUDIENCES })
  @IsIn(CAMPAIGN_AUDIENCES)
  audience: CampaignAudience;

  @ApiPropertyOptional({ enum: CUSTOMER_SEGMENTS })
  @IsOptional()
  @IsIn(CUSTOMER_SEGMENTS)
  segment?: CustomerSegment;
}

export class SubscriberQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SUBSCRIBER_STATUSES })
  @IsOptional()
  @IsIn(SUBSCRIBER_STATUSES)
  status?: SubscriberStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}
