import { Injectable } from '@nestjs/common';
import type { SitemapDataDto } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { VISIBLE } from '../catalog/product-cards';

const SITEMAP_LIMIT = 45_000;

/** Sitemap data for the storefront (products, categories and CMS pages). */
@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  async sitemap(): Promise<SitemapDataDto> {
    const [products, categories, pages] = await Promise.all([
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
      this.prisma.page.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
      }),
    ]);
    const iso = (d: Date) => d.toISOString();
    return {
      products: products.map((p) => ({ slug: p.slug, updatedAt: iso(p.updatedAt) })),
      categories: categories.map((c) => ({ slug: c.slug, updatedAt: iso(c.updatedAt) })),
      pages: pages.map((p) => ({ slug: p.slug, updatedAt: iso(p.updatedAt) })),
    };
  }
}
