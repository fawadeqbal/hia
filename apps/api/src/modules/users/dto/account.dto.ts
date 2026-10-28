import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  EmailPreferencesDto,
  ProfileInput,
} from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateProfileDto implements ProfileInput {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) firstName: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) lastName: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^[+0-9 ()-]{7,20}$/, { message: 'phone may contain digits, spaces, + ( ) - only' })
  phone?: string | null;
}

export class ChangePasswordDto implements ChangePasswordInput {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) currentPassword?: string;

  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(128) newPassword: string;
}

export class EmailPreferencesBody implements EmailPreferencesDto {
  @ApiProperty() @IsBoolean() marketing: boolean;

  @ApiProperty() @IsBoolean() productUpdates: boolean;
}

export class DeleteAccountDto implements DeleteAccountInput {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) password?: string;

  @ApiProperty({ example: 'DELETE' })
  @Matches(/^DELETE$/, { message: 'Type DELETE to confirm' })
  confirm: string;
}
