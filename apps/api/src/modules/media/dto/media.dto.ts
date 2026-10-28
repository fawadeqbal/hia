import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MEDIA_FOLDERS, type MediaFolder } from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** Text fields sent alongside the file in the multipart form. */
export class UploadMediaDto {
  @ApiPropertyOptional({ enum: MEDIA_FOLDERS, default: 'general' })
  @IsOptional()
  @IsIn(MEDIA_FOLDERS)
  folder?: MediaFolder;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;
}

export class MediaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MEDIA_FOLDERS })
  @IsOptional()
  @IsIn(MEDIA_FOLDERS)
  folder?: MediaFolder;
}

/** The parts of a Multer file we use (avoids depending on @types/multer). */
export interface UploadedImageFile {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype: string;
}
