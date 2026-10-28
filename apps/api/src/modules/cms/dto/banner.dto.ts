import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  BANNER_PLACEMENTS,
  LINK_REGEX,
  type BannerInput,
  type BannerPlacement,
} from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const url = { require_tld: false, protocols: ['http', 'https'], require_protocol: true };

/** Mirrors bannerFormSchema. */
export class CreateBannerDto implements BannerInput {
  @ApiProperty({ example: 'Winter sale' })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  title: string;

  @ApiProperty()
  @IsUrl(url)
  imageUrl: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(url)
  mobileImageUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '/products?featured=true' })
  @IsOptional()
  @Matches(LINK_REGEX, { message: 'linkUrl must be a path like /products or an http(s) URL' })
  linkUrl?: string | null;

  @ApiProperty({ enum: BANNER_PLACEMENTS })
  @IsIn([...BANNER_PLACEMENTS])
  placement: BannerPlacement;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  position?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}

export class BannerQueryDto {
  @ApiProperty({ enum: BANNER_PLACEMENTS })
  @IsIn([...BANNER_PLACEMENTS])
  placement: BannerPlacement;
}
