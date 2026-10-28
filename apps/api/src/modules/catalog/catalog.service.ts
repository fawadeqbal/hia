import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import type {
  CategoryTreeNode,
  Paginated,
  StorefrontOption,
  StorefrontProductCard,
  StorefrontProductDetail,
  StorefrontVariant,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { availableByVariant } from '../../common/utils/stock-availability';
import { VISIBLE, cardInclude, toProductCards } from './product-cards';
import { inStockProductIds, searchScores } from './product-search';
import { groupValueIds, normalizeQuery, orderByScore } from './search-rules';
import { PrismaService } from '../../prisma/prisma.service';
import type { ProductQueryDto, ProductSort } from './dto/product-query.dto';

const SORT: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  // Used when there is no search text (relevance needs a query).
  relevance: [{ soldCount: 'desc' }, { publishedAt: 'desc' }],
  newest: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  price_asc: [{ basePrice: 'asc' }],
  price_desc: [{ basePrice: 'desc' }],
  popular: [{ soldCount: 'desc' }],
  rating: [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }],
};

const detailInclude = {
  category: { select: { name: true, slug: true } },
  brand: { select: { name: true, slug: true } },
  vendor: { select: { name: true, slug: true, logoUrl: true } },
  images: { orderBy: { position: 'asc' }, select: { url: true, altText: true } },
  variants: {
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
    include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } },
  },
} satisfies Prisma.ProductInclude;

/** Public storefront catalog. */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(q: ProductQueryDto): Promise<Paginated<StorefrontProductCard>> {
    const term = normalizeQuery(q.q);
    const [categoryIds, scores, inStock, valueGroups] = await Promise.all([
      q.category ? this.categoryWithDescendants(q.category) : Promise.resolve(null),
      term ? searchScores(this.prisma, term) : Promise.resolve(null),
      q.inStock ? inStockProductIds(this.prisma) : Promise.resolve(null),
      q.values ? this.valueGroups(q.values) : Promise.resolve([] as string[][]),
    ]);

    // Search and stock filters both narrow the id set; intersect when both are present.
    let ids: string[] | null = scores ? [...scores.keys()] : null;
    if (inStock) ids = ids ? ids.filter((id) => inStock.has(id)) : [...inStock];

    const where: Prisma.ProductWhereInput = {
      ...VISIBLE,
      ...(q.vendor ? { vendor: { status: 'APPROVED', slug: q.vendor } } : {}),
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(q.brand ? { brand: { slug: q.brand } } : {}),
      ...(q.featured ? { isFeatured: true } : {}),
      ...(q.onSale ? { compareAtPrice: { gt: this.prisma.product.fields.basePrice } } : {}),
      ...(ids ? { id: { in: ids } } : {}),
      ...(q.minRating ? { ratingAverage: { gte: q.minRating } } : {}),
      ...(q.minPrice !== undefined || q.maxPrice !== undefined
        ? { basePrice: { gte: q.minPrice, lte: q.maxPrice } }
        : {}),
      ...(valueGroups.length > 0
        ? {
            AND: valueGroups.map((group) => ({
              variants: {
                some: { isActive: true, attributes: { some: { attributeValueId: { in: group } } } },
              },
            })),
          }
        : {}),
    };

    const sort: ProductSort = q.sort ?? (scores ? 'relevance' : 'newest');
    const skip = (q.page - 1) * q.limit;

    if (sort === 'relevance' && scores) {
      const matching = await this.prisma.product.findMany({ where, select: { id: true } });
      const ordered = orderByScore(
        matching.map((m) => m.id),
        scores,
      );
      const pageIds = ordered.slice(skip, skip + q.limit);
      const rows = await this.prisma.product.findMany({
        where: { id: { in: pageIds } },
        include: cardInclude,
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const cards = await toProductCards(
        this.prisma,
        pageIds.flatMap((id) => {
          const row = byId.get(id);
          return row ? [row] : [];
        }),
      );
      return paginate(cards, ordered.length, q.page, q.limit);
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: cardInclude,
        orderBy: SORT[sort],
        skip,
        take: q.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(await toProductCards(this.prisma, rows), total, q.page, q.limit);
  }

  private async valueGroups(raw: string): Promise<string[][]> {
    const ids = [
      ...new Set(
        raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].slice(0, 50);
    if (ids.length === 0) return [];
    const rows = await this.prisma.attributeValue.findMany({
      where: { id: { in: ids } },
      select: { id: true, attributeId: true },
    });
    return groupValueIds(rows);
  }

  async getProduct(slug: string): Promise<StorefrontProductDetail> {
    const p = await this.prisma.product.findFirst({
      where: { ...VISIBLE, slug },
      include: detailInclude,
    });
    if (!p || p.variants.length === 0) throw new NotFoundException('Product not found');

    const stock = await availableByVariant(
      this.prisma,
      p.variants.map((v) => v.id),
    );

    const options = new Map<
      string,
      StorefrontOption & { position: number; valuePositions: Map<string, number> }
    >();
    const variants: StorefrontVariant[] = p.variants.map((v) => {
      const values: Record<string, string> = {};
      for (const { attributeValue: val } of v.attributes) {
        values[val.attributeId] = val.id;
        const option = options.get(val.attributeId) ?? {
          attributeId: val.attributeId,
          name: val.attribute.name,
          type: val.attribute.type,
          values: [],
          position: val.attribute.position,
          valuePositions: new Map<string, number>(),
        };
        if (!option.values.some((x) => x.id === val.id)) {
          option.values.push({ id: val.id, label: val.label ?? val.value, swatch: val.swatch });
          option.valuePositions.set(val.id, val.position);
        }
        options.set(val.attributeId, option);
      }
      return {
        id: v.id,
        sku: v.sku,
        price: Number(v.price),
        compareAtPrice: v.compareAtPrice === null ? null : Number(v.compareAtPrice),
        isDefault: v.isDefault,
        available: stock.get(v.id) ?? 0,
        values,
        label: v.name,
      };
    });

    const defaultVariant =
      variants.find((v) => v.isDefault && v.available > 0) ??
      variants.find((v) => v.available > 0) ??
      variants[0];

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      shortDescription: p.shortDescription,
      description: p.description,
      specifications: Array.isArray(p.specifications)
        ? (p.specifications as unknown as { label: string; value: string }[])
        : [],
      images: p.images,
      currency: p.currency,
      price: Number(p.basePrice),
      compareAtPrice: p.compareAtPrice === null ? null : Number(p.compareAtPrice),
      ratingAverage: Number(p.ratingAverage),
      ratingCount: p.ratingCount,
      category: p.category,
      brand: p.brand,
      vendor: p.vendor,
      options: [...options.values()]
        .sort((a, b) => a.position - b.position)
        .map(({ position: _p, valuePositions, ...o }) => ({
          ...o,
          values: [...o.values].sort(
            (a, b) => (valuePositions.get(a.id) ?? 0) - (valuePositions.get(b.id) ?? 0),
          ),
        })),
      variants,
      defaultVariantId: defaultVariant.id,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
    };
  }

  /** Active categories as a nested tree (any depth) for storefront navigation. */
  async categoryTree(): Promise<CategoryTreeNode[]> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, parentId: true, name: true, slug: true, imageUrl: true },
    });
    const build = (parentId: string | null): CategoryTreeNode[] =>
      rows
        .filter((r) => r.parentId === parentId)
        .map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          imageUrl: r.imageUrl,
          children: build(r.id),
        }));
    return build(null);
  }

  /** A category slug expands to itself + all active descendants, so "Electronics" includes "Smartphones". */
  private async categoryWithDescendants(slug: string): Promise<string[]> {
    const all = await this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, parentId: true, slug: true },
    });
    const root = all.find((c) => c.slug === slug);
    if (!root) return ['__none__'];
    const ids = [root.id];
    for (let i = 0; i < ids.length; i++) {
      for (const c of all) if (c.parentId === ids[i]) ids.push(c.id);
    }
    return ids;
  }
}
