import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  VENDOR_REASON_MIN,
  VENDOR_STATUSES,
  type VendorAdminUpdateInput,
  type VendorApplicationInput,
  type VendorApproveInput,
  type VendorPayoutInput,
  type VendorPolicies,
  type VendorProfileInput,
  type VendorReasonInput,
  type VendorStatus,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const URL_OPTIONS = { require_tld: false, protocols: ['http', 'https'], require_protocol: true };

/** POST /vendors/apply — mirrors vendorApplicationSchema. */
export class ApplyVendorDto implements VendorApplicationInput {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) firstName: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) lastName: string;
  @ApiProperty() @Transform(trim) @IsEmail() email: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(128) password: string;
  @ApiProperty({ example: 'Lahore Gadgets' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  storeName: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

export class VendorPoliciesDto implements VendorPolicies {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) shipping?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) returns?: string;
}

/** PATCH /vendor/me — mirrors vendorProfileFormSchema. */
export class UpdateVendorProfileDto implements VendorProfileInput {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(2, 80) name?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(30) phone?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(2000) description?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUrl(URL_OPTIONS) logoUrl?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUrl(URL_OPTIONS) bannerUrl?:
    | string
    | null;

  @ApiPropertyOptional({ type: VendorPoliciesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VendorPoliciesDto)
  policies?: VendorPoliciesDto;
}

/** PUT /vendor/me/payout — mirrors vendorPayoutFormSchema. */
export class UpdateVendorPayoutDto implements VendorPayoutInput {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100) bankAccountName: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100) bankName: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(4, 40)
  @Matches(/^[A-Za-z0-9 -]+$/, {
    message: 'bankAccountNumber may contain letters, numbers, spaces and hyphens',
  })
  bankAccountNumber: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(34) iban?:
    | string
    | null;
}

export class ApproveVendorDto implements VendorApproveInput {
  @ApiPropertyOptional({
    description: 'Commission % for this vendor (default: platform setting)',
    example: 10,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate?: number;
}

export class VendorReasonDto implements VendorReasonInput {
  @ApiProperty({
    minLength: VENDOR_REASON_MIN,
    description: 'Shown to the vendor and included in the email',
  })
  @Transform(trim)
  @IsString()
  @Length(VENDOR_REASON_MIN, 1000)
  reason: string;
}

export class AdminUpdateVendorDto implements VendorAdminUpdateInput {
  @ApiPropertyOptional({
    nullable: true,
    description: "Sets the seller's commission rule; null removes it",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate?: number | null;
}

export class VendorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VENDOR_STATUSES })
  @IsOptional()
  @IsIn(VENDOR_STATUSES)
  status?: VendorStatus;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
}
