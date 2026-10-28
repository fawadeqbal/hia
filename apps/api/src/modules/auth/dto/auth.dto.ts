import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  ForgotPasswordInput,
  OtpRequestInput,
  OtpVerifyInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@ecommerce/types';

const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  lastName: string;

  @ApiPropertyOptional({ description: "Friend's referral code" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;
}

export class LoginDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}

/** Refresh token may come from the body (mobile/API clients) or the refresh_token cookie (browsers). */
export class RefreshDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto implements ForgotPasswordInput {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email: string;
}

export class ResetPasswordDto implements ResetPasswordInput {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  token: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class VerifyEmailDto implements VerifyEmailInput {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  token: string;
}

export class OtpRequestDto implements OtpRequestInput {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email: string;
}

export class OtpVerifyDto implements OtpVerifyInput {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
