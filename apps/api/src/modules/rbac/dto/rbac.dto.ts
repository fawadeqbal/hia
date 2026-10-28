import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  ROLE_NAME_REGEX,
  type AuditLogQuery,
  type InviteStaffInput,
  type RoleInput,
  type UpdateStaffRolesInput,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateRoleDto implements RoleInput {
  @ApiProperty({ example: 'ORDER_MANAGER' })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .trim()
          .toUpperCase()
          .replace(/[\s-]+/g, '_')
      : value,
  )
  @Matches(ROLE_NAME_REGEX, { message: 'name: 3–40 characters, capital letters, digits and _' })
  name: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(200) description?:
    | string
    | null;

  @ApiProperty({ type: [String], example: ['orders.manage', 'customers.view'] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(200) description?:
    | string
    | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions?: string[];
}

export class InviteStaffDto implements InviteStaffInput {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) firstName: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) lastName: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  roleIds: string[];
}

export class UpdateStaffRolesDto implements UpdateStaffRolesInput {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  roleIds: string[];
}

export class AuditLogQueryDto extends PaginationQueryDto implements AuditLogQuery {
  @ApiPropertyOptional({ description: 'Contains, e.g. "order"' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ example: 'Order' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  entityType?: string;

  @ApiPropertyOptional({ description: 'Actor email contains' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  actor?: string;

  @ApiPropertyOptional({ example: '2026-10-01' }) @IsOptional() @IsDateString() from?: string;

  @ApiPropertyOptional({ example: '2026-10-12' }) @IsOptional() @IsDateString() to?: string;
}
