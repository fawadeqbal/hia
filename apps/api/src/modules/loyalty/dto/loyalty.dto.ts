import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  AdjustGiftCardInput,
  AdjustPointsInput,
  IssueGiftCardInput,
  UpdateTierInput,
} from '@ecommerce/types';

export class IssueGiftCardDto implements IssueGiftCardInput {
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(100000) amount: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsEmail() recipientEmail: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(80) senderName:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(300) message:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateString() expiresAt: string | null;
}

export class AdjustGiftCardDto implements AdjustGiftCardInput {
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) amount: number;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) note: string;
}

export class GiftCardActiveDto {
  @ApiProperty() @IsBoolean() isActive: boolean;
}

export class UpdateTierDto implements UpdateTierInput {
  @ApiProperty() @IsInt() @Min(0) minPoints: number;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.5) @Max(10) multiplier: number;
}

export class AdjustPointsDto implements AdjustPointsInput {
  @ApiProperty() @IsInt() @Min(-1000000) @Max(1000000) points: number;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) reason: string;
}
