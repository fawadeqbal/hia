import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Brand } from '@ecommerce/database';
import type { BrandDto, BrandListItem } from '@ecommerce/types';
import { uniqueSlug } from '../../../common/utils/unique-slug';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

/**
 * Brand management. Rules: unique slug (auto-generated from name),
 * cannot delete a brand that still has products (hide it instead).
 */
@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Public: active brands, A–Z. */
  async listActive(): Promise<BrandDto[]> {
    const brands = await this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return brands.map(toBrandDto);
  }

  /** Admin: all brands with product counts. */
  async list(): Promise<BrandListItem[]> {
    const brands = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return brands.map((b) => ({ ...toBrandDto(b), productCount: b._count.products }));
  }

  async get(id: string): Promise<BrandDto> {
    return toBrandDto(await this.findOrThrow(id));
  }

  async create(dto: CreateBrandDto, actorId?: string): Promise<BrandDto> {
    const created = await this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: await this.resolveSlug(dto.slug, dto.name),
        logoUrl: dto.logoUrl ?? null,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      actorId,
      action: 'catalog.brand.create',
      entityType: 'Brand',
      entityId: created.id,
      after: created,
    });
    return toBrandDto(created);
  }

  async update(id: string, dto: UpdateBrandDto, actorId?: string): Promise<BrandDto> {
    const existing = await this.findOrThrow(id);
    const slug =
      dto.slug !== undefined && dto.slug !== existing.slug
        ? await this.resolveSlug(dto.slug, dto.name ?? existing.name, id)
        : undefined;

    const updated = await this.prisma.brand.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        logoUrl: dto.logoUrl,
        description: dto.description,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      actorId,
      action: 'catalog.brand.update',
      entityType: 'Brand',
      entityId: id,
      before: existing,
      after: updated,
    });
    return toBrandDto(updated);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand._count.products > 0) {
      throw new ConflictException(
        `"${brand.name}" is used by ${brand._count.products} products. Hide it (set inactive) or reassign the products first.`,
      );
    }
    await this.prisma.brand.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'catalog.brand.delete',
      entityType: 'Brand',
      entityId: id,
      before: brand,
    });
  }

  private async findOrThrow(id: string): Promise<Brand> {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  private resolveSlug(
    requested: string | undefined,
    name: string,
    excludeId?: string,
  ): Promise<string> {
    return uniqueSlug({
      requested,
      source: name,
      entity: 'brand',
      isTaken: async (slug) =>
        Boolean(
          await this.prisma.brand.findFirst({
            where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
            select: { id: true },
          }),
        ),
    });
  }
}

export function toBrandDto(b: Brand): BrandDto {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    logoUrl: b.logoUrl,
    description: b.description,
    isActive: b.isActive,
    createdAt: b.createdAt.toISOString(),
  };
}
