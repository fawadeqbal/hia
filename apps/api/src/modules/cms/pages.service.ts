import { Injectable, NotFoundException } from '@nestjs/common';
import type { Page, Prisma } from '@ecommerce/database';
import type { PageDto, PageListItem } from '@ecommerce/types';
import { uniqueSlug } from '../../common/utils/unique-slug';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { parsePageContent } from './cms-rules';
import { toPageDto, toPageListItem } from './cms.mapper';
import type { CreatePageDto, UpdatePageDto } from './dto/page.dto';

export const DEFAULT_LOCALE = 'en';

/**
 * Content pages (About, Terms…). Rules: slug unique per locale, content validated block by block,
 * publishedAt set the first time a page is published.
 */
@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<PageListItem[]> {
    const pages = await this.prisma.page.findMany({ orderBy: { updatedAt: 'desc' } });
    return pages.map(toPageListItem);
  }

  async get(id: string): Promise<PageDto> {
    return toPageDto(await this.findOrThrow(id));
  }

  async create(dto: CreatePageDto, actorId?: string): Promise<PageDto> {
    const content = parsePageContent(dto.content);
    const locale = dto.locale ?? DEFAULT_LOCALE;
    const created = await this.prisma.page.create({
      data: {
        title: dto.title,
        slug: await this.resolveSlug(dto.slug, dto.title, locale),
        locale,
        content: content as unknown as Prisma.InputJsonValue,
        status: dto.status,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
      },
    });
    await this.audit.log({
      actorId,
      action: 'cms.page.create',
      entityType: 'Page',
      entityId: created.id,
      after: created,
    });
    return toPageDto(created);
  }

  async update(id: string, dto: UpdatePageDto, actorId?: string): Promise<PageDto> {
    const existing = await this.findOrThrow(id);
    const locale = dto.locale ?? existing.locale;
    const slugChanged =
      (dto.slug !== undefined && dto.slug !== existing.slug) || locale !== existing.locale;
    const firstPublish = dto.status === 'PUBLISHED' && existing.status !== 'PUBLISHED';

    const updated = await this.prisma.page.update({
      where: { id },
      data: {
        title: dto.title,
        slug: slugChanged
          ? await this.resolveSlug(
              dto.slug ?? existing.slug,
              dto.title ?? existing.title,
              locale,
              id,
            )
          : undefined,
        locale: dto.locale,
        content:
          dto.content !== undefined
            ? (parsePageContent(dto.content) as unknown as Prisma.InputJsonValue)
            : undefined,
        status: dto.status,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        publishedAt: firstPublish ? new Date() : undefined,
      },
    });
    await this.audit.log({
      actorId,
      action: 'cms.page.update',
      entityType: 'Page',
      entityId: id,
      before: existing,
      after: updated,
    });
    return toPageDto(updated);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const existing = await this.findOrThrow(id);
    await this.prisma.page.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'cms.page.delete',
      entityType: 'Page',
      entityId: id,
      before: existing,
    });
  }

  private async findOrThrow(id: string): Promise<Page> {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  private resolveSlug(
    requested: string | undefined,
    source: string,
    locale: string,
    excludeId?: string,
  ) {
    return uniqueSlug({
      requested,
      source,
      entity: 'page',
      isTaken: async (slug) =>
        (await this.prisma.page.findFirst({
          where: { slug, locale, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
          select: { id: true },
        })) !== null,
    });
  }
}
