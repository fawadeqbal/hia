import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length, MaxLength } from 'class-validator';
import {
  REDIRECT_STATUS_CODES,
  type RedirectInput,
  type RedirectStatusCode,
} from '@ecommerce/types';

export class RedirectDtoBody implements RedirectInput {
  @ApiProperty({ example: '/old-page' })
  @IsString()
  @Length(1, 500)
  fromPath: string;

  @ApiProperty({ example: '/pages/about' })
  @IsString()
  @Length(1, 500)
  toPath: string;

  @ApiProperty({ enum: REDIRECT_STATUS_CODES })
  @IsIn(REDIRECT_STATUS_CODES)
  statusCode: RedirectStatusCode;
}

export class RedirectImportDto {
  @ApiProperty({ description: '"old new [301|302]" per line' })
  @IsString()
  @MaxLength(200_000)
  text: string;
}
