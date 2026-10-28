import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  PublicBrandPage,
  PublicStorePage,
  StorefrontProductCard,
  VendorPolicies,
} from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { VISIBLE, cardsForIds } from './product-cards';

const MAX_SLUGS = 20;
const VIEW_DEDUPE_MS = 30 * 60_000;

/** Brand & store pages, recently viewed cards, product view tracking. */
@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async brandPage(slug: string): Promise<PublicBrandPage> {
    const brand = await this.prisma.brand.findFirst({ where: { slug, isActive: true } });
    if (!brand) throw new NotFoundException('Brand not found');
    const productCount = await this.prisma.product.count({
      where: { ...VISIBLE, brandId: brand.id },
    });
    return {
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
      description: brand.description,
      productCount,
    };
  }

  async storePage(slug: string): Promise<PublicStorePage> {
    const vendor = await this.prisma.vendor.findFirst({ where: { slug, status: 'APPROVED' } });
    if (!vendor) throw new NotFoundException('Store not found');
    const [productCount, reviews] = await Promise.all([
      this.prisma.product.count({ where: { ...VISIBLE, vendorId: vendor.id } }),
      this.prisma.product.aggregate({
        where: { ...VISIBLE, vendorId: vendor.id },
        _sum: { ratingCount: true },
      }),
    ]);
    const policies = (vendor.policies ?? {}) as VendorPolicies;
    return {
      name: vendor.name,
      slug: vendor.slug,
      logoUrl: vendor.logoUrl,
      bannerUrl: vendor.bannerUrl,
      description: vendor.description,
      ratingAverage: Number(vendor.ratingAverage),
      reviewCount: reviews._sum.ratingCount ?? 0,
      productCount,
      joinedAt: (vendor.approvedAt ?? vendor.createdAt).toISOString(),
      policies: { shipping: policies.shipping ?? null, returns: policies.returns ?? null },
    };
  }

  /** Cards for slugs (recently viewed), same order, hidden products skipped. */
  async bySlugs(raw: string): Promise<StorefrontProductCard[]> {
    const slugs = [
      ...new Set(
        raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].slice(0, MAX_SLUGS);
    if (slugs.length === 0) return [];
    const rows = await this.prisma.product.findMany({
      where: { ...VISIBLE, slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));
    return cardsForIds(
      this.prisma,
      slugs.flatMap((s) => {
        const id = idBySlug.get(s);
        return id ? [id] : [];
      }),
    );
  }

  /** One view per visitor per product per 30 minutes (feeds seller views / conversion). */
  async recordView(
    slug: string,
    userId: string | undefined,
    sessionId: string | undefined,
  ): Promise<void> {
    if (!userId && !sessionId) return;
    const product = await this.prisma.product.findFirst({
      where: { ...VISIBLE, slug },
      select: { id: true },
    });
    if (!product) return;
    const recent = await this.prisma.productView.findFirst({
      where: {
        productId: product.id,
        viewedAt: { gt: new Date(Date.now() - VIEW_DEDUPE_MS) },
        ...(userId ? { userId } : { sessionId }),
      },
      select: { id: true },
    });
    if (recent) return;
    await this.prisma.productView.create({
      data: {
        productId: product.id,
        userId: userId ?? null,
        sessionId: userId ? null : (sessionId ?? null),
      },
    });
  }
}
