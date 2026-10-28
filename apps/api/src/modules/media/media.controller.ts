import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  MAX_UPLOAD_BYTES,
  MEDIA_FOLDERS,
  Role,
  type MediaDto,
  type Paginated,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MediaQueryDto, UploadMediaDto, type UploadedImageFile } from './dto/media.dto';
import { MediaService } from './media.service';

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /** Staff and vendors upload images (category/brand images, product photos, banners…). */
  @Post()
  @Roles(Role.ADMIN, Role.CONTENT_MANAGER, Role.MARKETING_MANAGER, Role.VENDOR, Role.VENDOR_STAFF)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string', enum: [...MEDIA_FOLDERS], default: 'general' },
        altText: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: UploadedImageFile | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<MediaDto> {
    return this.mediaService.uploadImage(file, dto.folder ?? 'general', actorId, dto.altText);
  }

  @Get()
  @Roles(Role.ADMIN, Role.CONTENT_MANAGER)
  list(@Query() query: MediaQueryDto): Promise<Paginated<MediaDto>> {
    return this.mediaService.list(query.page, query.limit, query.folder);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.mediaService.remove(id, actorId);
  }
}
