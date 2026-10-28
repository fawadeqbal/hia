import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Media } from '@ecommerce/database';
import type { MediaDto, MediaFolder, Paginated } from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { detectImage } from './detect-image';
import type { UploadedImageFile } from './dto/media.dto';
import { StorageService } from './storage.service';

/**
 * MediaService — image uploads to object storage + the Media library table.
 * TODO: resized WebP/AVIF variants via the media queue; video & document uploads.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async uploadImage(
    file: UploadedImageFile | undefined,
    folder: MediaFolder,
    actorId?: string,
    altText?: string,
  ): Promise<MediaDto> {
    if (!file || file.size === 0)
      throw new BadRequestException('No file received (multipart field name must be "file")');

    const image = detectImage(file.buffer);
    if (!image)
      throw new BadRequestException(
        'Unsupported file. Upload a JPEG, PNG, WebP, GIF or AVIF image.',
      );

    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const key = `${folder}/${now.getUTCFullYear()}/${month}/${randomUUID()}.${image.ext}`;

    const url = await this.storage.put(key, file.buffer, image.mime);

    const media = await this.prisma.media.create({
      data: {
        uploadedById: actorId,
        type: 'IMAGE',
        url,
        key,
        mimeType: image.mime,
        sizeBytes: file.size,
        width: image.width,
        height: image.height,
        altText: altText?.trim() || null,
      },
    });
    return toMediaDto(media);
  }

  async list(page: number, limit: number, folder?: MediaFolder): Promise<Paginated<MediaDto>> {
    const where = folder ? { key: { startsWith: `${folder}/` } } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.media.count({ where }),
    ]);
    return paginate(items.map(toMediaDto), total, page, limit);
  }

  /** Deletes the file and its record. Pages still pointing at the URL will show a broken image. */
  async remove(id: string, actorId?: string): Promise<void> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');
    try {
      await this.storage.delete(media.key);
    } catch (error) {
      this.logger.warn(`Could not delete object ${media.key}: ${String(error)}`);
    }
    await this.prisma.media.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'media.delete',
      entityType: 'Media',
      entityId: id,
      before: media,
    });
  }

  status() {
    return { module: 'media', status: 'partial' };
  }
}

export function toMediaDto(m: Media): MediaDto {
  return {
    id: m.id,
    type: m.type,
    url: m.url,
    key: m.key,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    width: m.width,
    height: m.height,
    altText: m.altText,
    createdAt: m.createdAt.toISOString(),
  };
}
