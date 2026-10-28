import { Injectable } from '@nestjs/common';
import type { StorefrontProductCard } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { VISIBLE, cardsForIds } from './product-cards';

const MAX_SLUGS = 20;
const VIEW_DEDUPE_MS = 30 * 60_000;

/** Recently viewed cards and product view tracking. */
@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

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
