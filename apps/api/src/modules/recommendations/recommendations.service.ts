import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ecommerce/database';
import type { ProductRecommendations } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { VISIBLE, cardsForIds } from '../catalog/product-cards';

const RELATED = 8;
const TOGETHER = 4;

/** "Related products" (same category, then brand) and "frequently bought together" (order co-occurrence). */
@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async forProduct(slug: string): Promise<ProductRecommendations> {
    const product = await this.prisma.product.findFirst({
      where: { ...VISIBLE, slug },
      select: { id: true, categoryId: true, brandId: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const together = await this.prisma.$queryRaw<{ productId: string }[]>(Prisma.sql`
      SELECT pv2."productId", COUNT(DISTINCT oi2."orderId") AS "orders"
      FROM "OrderItem" oi
      JOIN "ProductVariant" pv ON pv."id" = oi."variantId"
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "OrderItem" oi2 ON oi2."orderId" = oi."orderId"
      JOIN "ProductVariant" pv2 ON pv2."id" = oi2."variantId"
      WHERE pv."productId" = ${product.id}
        AND pv2."productId" <> ${product.id}
        AND o."status" NOT IN ('CANCELLED', 'PENDING_PAYMENT')
      GROUP BY pv2."productId"
      ORDER BY "orders" DESC
      LIMIT ${TOGETHER * 2}`);
    const togetherIds = together.map((r) => r.productId);

    const sameCategory = await this.prisma.product.findMany({
      where: {
        ...VISIBLE,
        categoryId: product.categoryId,
        id: { notIn: [product.id, ...togetherIds] },
      },
      orderBy: [{ soldCount: 'desc' }, { ratingAverage: 'desc' }],
      take: RELATED,
      select: { id: true },
    });
    let relatedIds = sameCategory.map((p) => p.id);
    if (relatedIds.length < RELATED && product.brandId) {
      const sameBrand = await this.prisma.product.findMany({
        where: {
          ...VISIBLE,
          brandId: product.brandId,
          id: { notIn: [product.id, ...togetherIds, ...relatedIds] },
        },
        orderBy: { soldCount: 'desc' },
        take: RELATED - relatedIds.length,
        select: { id: true },
      });
      relatedIds = [...relatedIds, ...sameBrand.map((p) => p.id)];
    }

    const [related, boughtTogether] = await Promise.all([
      cardsForIds(this.prisma, relatedIds),
      cardsForIds(this.prisma, togetherIds),
    ]);
    return { related, boughtTogether: boughtTogether.slice(0, TOGETHER) };
  }
}
