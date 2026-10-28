import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsString, Length } from 'class-validator';
import {
  VENDOR_STAFF_PERMISSIONS,
  type InviteVendorStaffInput,
  type VendorStaffPermission,
} from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class InviteVendorStaffDto implements InviteVendorStaffInput {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) firstName: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) lastName: string;

  @ApiProperty({ enum: VENDOR_STAFF_PERMISSIONS, isArray: true })
  @IsArray()
  @ArrayMaxSize(VENDOR_STAFF_PERMISSIONS.length)
  @IsIn([...VENDOR_STAFF_PERMISSIONS], { each: true })
  permissions: VendorStaffPermission[];
}

export class UpdateVendorStaffDto {
  @ApiProperty({ enum: VENDOR_STAFF_PERMISSIONS, isArray: true })
  @IsArray()
  @ArrayMaxSize(VENDOR_STAFF_PERMISSIONS.length)
  @IsIn([...VENDOR_STAFF_PERMISSIONS], { each: true })
  permissions: VendorStaffPermission[];
}
