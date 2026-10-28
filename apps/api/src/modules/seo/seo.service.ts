import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Redirect } from '@ecommerce/database';
import {
  REDIRECT_STATUS_CODES,
  normalizePath,
  type PublicRedirect,
  type RedirectDto,
  type RedirectImportResult,
  type RedirectInput,
  type RedirectStatusCode,
  type SitemapDataDto,
} from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { VISIBLE } from '../catalog/product-cards';
import { createsLoop, fromPathProblem, normalizeTarget, parseImport } from './seo-rules';

const SITEMAP_LIMIT = 45_000;
const MAX_REDIRECTS = 5_000;

/** 301 / 302 redirect manager and sitemap data for the storefront. */
@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<RedirectDto[]> {
    const rows = await this.prisma.redirect.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_REDIRECTS,
    });
    return rows.map(toRedirectDto);
  }

  async create(input: RedirectInput, actorId?: string): Promise<RedirectDto> {
    const v = await this.validate(input);
    if (await this.prisma.redirect.findUnique({ where: { fromPath: v.fromPath } }))
      throw new ConflictException(`${v.fromPath} already redirects somewhere`);
    if ((await this.prisma.redirect.count()) >= MAX_REDIRECTS)
      throw new BadRequestException(`At most ${MAX_REDIRECTS} redirects`);
    const r = await this.prisma.redirect.create({ data: v });
    await this.audit.log({
      actorId,
      action: 'seo.redirect.create',
      entityType: 'Redirect',
      entityId: r.id,
      after: v,
    });
    return toRedirectDto(r);
  }

  async update(id: string, input: RedirectInput, actorId?: string): Promise<RedirectDto> {
    const before = await this.findOrThrow(id);
    const v = await this.validate(input, id);
    const clash = await this.prisma.redirect.findUnique({ where: { fromPath: v.fromPath } });
    if (clash && clash.id !== id)
      throw new ConflictException(`${v.fromPath} already redirects somewhere`);
    const r = await this.prisma.redirect.update({ where: { id }, data: v });
    await this.audit.log({
      actorId,
      action: 'seo.redirect.update',
      entityType: 'Redirect',
      entityId: id,
      before,
      after: v,
    });
    return toRedirectDto(r);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const before = await this.findOrThrow(id);
    await this.prisma.redirect.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'seo.redirect.delete',
      entityType: 'Redirect',
      entityId: id,
      before,
    });
  }

  /** Bulk add / update from "old new [status]" lines; invalid lines are reported, valid ones saved. */
  async import(text: string, actorId?: string): Promise<RedirectImportResult> {
    const result: RedirectImportResult = { created: 0, updated: 0, errors: [] };
    const lines = parseImport(text);
    if (lines.length > 1000) throw new BadRequestException('At most 1000 lines per import');
    for (const l of lines) {
      try {
        if (!(REDIRECT_STATUS_CODES as readonly number[]).includes(l.status))
          throw new Error('status must be 301 or 302');
        const input = {
          fromPath: l.from,
          toPath: l.to,
          statusCode: l.status as RedirectStatusCode,
        };
        const existing = await this.prisma.redirect.findUnique({
          where: { fromPath: normalizePath(l.from) },
        });
        const v = await this.validate(input, existing?.id);
        if (existing) {
          await this.prisma.redirect.update({ where: { id: existing.id }, data: v });
          result.updated++;
        } else {
          await this.prisma.redirect.create({ data: v });
          result.created++;
        }
      } catch (error) {
        result.errors.push(`Line ${l.line}: ${(error as Error).message}`);
      }
    }
    await this.audit.log({
      actorId,
      action: 'seo.redirect.import',
      entityType: 'Redirect',
      entityId: 'bulk',
      after: result,
    });
    return result;
  }

  // ---------------------------------------------------------------- storefront
  async publicRedirects(): Promise<PublicRedirect[]> {
    const rows = await this.prisma.redirect.findMany({
      select: { fromPath: true, toPath: true, statusCode: true },
      take: MAX_REDIRECTS,
    });
    return rows.map((r) => ({
      from: r.fromPath,
      to: r.toPath,
      status: r.statusCode as RedirectStatusCode,
    }));
  }

  async sitemap(): Promise<SitemapDataDto> {
    const [products, categories, brands, stores] = await Promise.all([
      this.prisma.product.findMany({
        where: VISIBLE,
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: SITEMAP_LIMIT,
      }),
      this.prisma.category.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        take: SITEMAP_LIMIT,
      }),
      this.prisma.brand.findMany({
        where: { isActive: true },
        select: { slug: true, createdAt: true },
        take: SITEMAP_LIMIT,
      }),
      this.prisma.vendor.findMany({
        where: { status: 'APPROVED' },
        select: { slug: true, updatedAt: true },
        take: SITEMAP_LIMIT,
      }),
    ]);
    const iso = (d: Date) => d.toISOString();
    return {
      products: products.map((p) => ({ slug: p.slug, updatedAt: iso(p.updatedAt) })),
      categories: categories.map((c) => ({ slug: c.slug, updatedAt: iso(c.updatedAt) })),
      brands: brands.map((b) => ({ slug: b.slug, updatedAt: iso(b.createdAt) })),
      stores: stores.map((s) => ({ slug: s.slug, updatedAt: iso(s.updatedAt) })),
    };
  }

  // ---------------------------------------------------------------- internals
  private async validate(
    input: RedirectInput,
    excludeId?: string,
  ): Promise<{ fromPath: string; toPath: string; statusCode: number }> {
    const rawTarget = input.toPath.trim();
    if (!rawTarget.startsWith('/') && !/^https?:\/\/\S+$/i.test(rawTarget))
      throw new BadRequestException('The new address must start with / or be a full https link');
    const fromPath = normalizePath(input.fromPath);
    const toPath = normalizeTarget(rawTarget);
    if (!toPath.startsWith('/') && !/^https?:\/\/\S+$/i.test(toPath))
      throw new BadRequestException('The new address must be a path or a full https link');
    const problem = fromPathProblem(fromPath);
    if (problem) throw new BadRequestException(problem);
    if (fromPath === toPath) throw new BadRequestException('The new address must be different');
    const others = await this.prisma.redirect.findMany({
      where: excludeId ? { NOT: { id: excludeId } } : {},
      select: { fromPath: true, toPath: true },
    });
    if (createsLoop(fromPath, toPath, new Map(others.map((o) => [o.fromPath, o.toPath]))))
      throw new BadRequestException(
        `This would create a redirect loop (${fromPath} → ${toPath} → … → ${fromPath})`,
      );
    return { fromPath, toPath, statusCode: input.statusCode };
  }

  private async findOrThrow(id: string): Promise<Redirect> {
    const r = await this.prisma.redirect.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Redirect not found');
    return r;
  }
}

export const toRedirectDto = (r: Redirect): RedirectDto => ({
  id: r.id,
  fromPath: r.fromPath,
  toPath: r.toPath,
  statusCode: r.statusCode as RedirectStatusCode,
  createdAt: r.createdAt.toISOString(),
});
