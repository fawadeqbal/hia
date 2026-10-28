import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class BySlugsQueryDto {
  @ApiProperty({
    example: 'galaxy-s24-ultra-256gb,iphone-15-128gb',
    description: 'Up to 20 comma-separated slugs',
  })
  @IsString()
  @MaxLength(3000)
  slugs: string;
}

export class RecordViewDto {
  @ApiPropertyOptional({ description: 'Anonymous visitor id kept by the browser' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{8,64}$/, { message: 'sessionId must be 8–64 letters, digits or dashes' })
  sessionId?: string;
}
