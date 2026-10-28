import { Injectable } from '@nestjs/common';
import type { DidYouMean, SearchSuggestions } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { VISIBLE } from '../catalog/product-cards';
import { closestTerm, searchScores } from '../catalog/product-search';
import { normalizeQuery } from '../catalog/search-rules';

const MIN_CHARS = 2;

/** Header autocomplete and "did you mean" (typo-tolerant, pg_trgm). */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(raw: string): Promise<SearchSuggestions> {
    const q = normalizeQuery(raw, 60);
    if (q.length < MIN_CHARS) return { products: [], categories: [], brands: [] };
    const scores = await searchScores(this.prisma, q);
    const topIds = [...scores.keys()].slice(0, 6);
    const [products, categories, brands] = await Promise.all([
      this.prisma.product.findMany({
        where: { ...VISIBLE, id: { in: topIds } },
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          currency: true,
          images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
        },
      }),
      this.prisma.category.findMany({
        where: { isActive: true, name: { contains: q, mode: 'insensitive' } },
        select: { name: true, slug: true },
        take: 3,
      }),
      this.prisma.brand.findMany({
        where: { isActive: true, name: { contains: q, mode: 'insensitive' } },
        select: { name: true, slug: true },
        take: 3,
      }),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));
    return {
      products: topIds.flatMap((id) => {
        const p = byId.get(id);
        return p
          ? [
              {
                name: p.name,
                slug: p.slug,
                imageUrl: p.images[0]?.url ?? null,
                price: Number(p.basePrice),
                currency: p.currency,
              },
            ]
          : [];
      }),
      categories,
      brands,
    };
  }

  async didYouMean(raw: string): Promise<DidYouMean> {
    const q = normalizeQuery(raw, 60);
    if (q.length < MIN_CHARS) return { suggestion: null };
    return { suggestion: await closestTerm(this.prisma, q) };
  }
}
