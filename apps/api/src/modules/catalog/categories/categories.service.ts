import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Category } from '@ecommerce/database';
import type { CategoryDto, CategoryListItem } from '@ecommerce/types';
import { uniqueSlug } from '../../../common/utils/unique-slug';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

type CategoryWithCounts = Category & { _count: { products: number; children: number } };

/**
 * Admin category management.
 * Rules: unique slug (auto-generated from name), no cycles in the tree,
 * cannot delete a category that still has subcategories or products.
 */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** All categories as a flattened tree (depth-first, ordered by position then name). */
  async list(): Promise<CategoryListItem[]> {
    const rows: CategoryWithCounts[] = await this.prisma.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true, children: true } } },
    });

    const byParent = new Map<string | null, CategoryWithCounts[]>();
    for (const row of rows) {
      const siblings = byParent.get(row.parentId) ?? [];
      siblings.push(row);
      byParent.set(row.parentId, siblings);
    }
    const names = new Map(rows.map((r) => [r.id, r.name]));

    const result: CategoryListItem[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const row of byParent.get(parentId) ?? []) {
        result.push({
          ...toDto(row),
          depth,
          parentName: row.parentId ? (names.get(row.parentId) ?? null) : null,
          productCount: row._count.products,
          childCount: row._count.children,
        });
        walk(row.id, depth + 1);
      }
    };
    walk(null, 0);
    return result;
  }

  async get(id: string): Promise<CategoryDto> {
    return toDto(await this.findOrThrow(id));
  }

  async create(dto: CreateCategoryDto, actorId?: string): Promise<CategoryDto> {
    const parentId = dto.parentId || null;
    if (parentId) await this.findOrThrow(parentId, 'Parent category not found');

    const created = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug: await this.resolveSlug(dto.slug, dto.name),
        parentId,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
      },
    });

    await this.audit.log({
      actorId,
      action: 'catalog.category.create',
      entityType: 'Category',
      entityId: created.id,
      after: created,
    });
    return toDto(created);
  }

  async update(id: string, dto: UpdateCategoryDto, actorId?: string): Promise<CategoryDto> {
    const existing = await this.findOrThrow(id);

    let parentId: string | null | undefined;
    if (dto.parentId !== undefined) {
      parentId = dto.parentId || null;
      if (parentId) await this.assertValidParent(id, parentId);
    }

    const slug =
      dto.slug !== undefined && dto.slug !== existing.slug
        ? await this.resolveSlug(dto.slug, dto.name ?? existing.name, id)
        : undefined;

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        parentId,
        description: dto.description,
        imageUrl: dto.imageUrl,
        position: dto.position,
        isActive: dto.isActive,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
    });

    await this.audit.log({
      actorId,
      action: 'catalog.category.update',
      entityType: 'Category',
      entityId: id,
      before: existing,
      after: updated,
    });
    return toDto(updated);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category._count.children > 0) {
      throw new ConflictException(
        `"${category.name}" has ${category._count.children} subcategories. Move or delete them first.`,
      );
    }
    if (category._count.products > 0) {
      throw new ConflictException(
        `"${category.name}" has ${category._count.products} products. Move them to another category first.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'catalog.category.delete',
      entityType: 'Category',
      entityId: id,
      before: category,
    });
  }

  // ---------------------------------------------------------------- helpers

  private async findOrThrow(id: string, message = 'Category not found'): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException(message);
    return category;
  }

  /** Parent must exist and must not be the category itself or one of its descendants. */
  private async assertValidParent(id: string, parentId: string): Promise<void> {
    let current: string | null = parentId;
    while (current) {
      if (current === id) {
        throw new BadRequestException(
          'A category cannot be moved under itself or its own subcategory',
        );
      }
      const node: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      if (!node) throw new NotFoundException('Parent category not found');
      current = node.parentId;
    }
  }

  private resolveSlug(
    requested: string | undefined,
    name: string,
    excludeId?: string,
  ): Promise<string> {
    return uniqueSlug({
      requested,
      source: name,
      entity: 'category',
      isTaken: async (slug) =>
        Boolean(
          await this.prisma.category.findFirst({
            where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
            select: { id: true },
          }),
        ),
    });
  }
}

export function toDto(c: Category): CategoryDto {
  return {
    id: c.id,
    parentId: c.parentId,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    position: c.position,
    isActive: c.isActive,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
