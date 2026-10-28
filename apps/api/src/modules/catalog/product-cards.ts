import type { Prisma } from '@ecommerce/database';
import type { StorefrontProductCard } from '@ecommerce/types';
import { availableByVariant } from '../../common/utils/stock-availability';
import type { PrismaService } from '../../prisma/prisma.service';

/** Only published, not deleted products of approved vendors are ever visible. */
export const VISIBLE: Prisma.ProductWhereInput = {
  status: 'PUBLISHED',
  deletedAt: null,
  vendor: { status: 'APPROVED' },
};

export const cardInclude = {
  brand: { select: { name: true } },
  vendor: { select: { name: true, slug: true } },
  images: { orderBy: { position: 'asc' }, take: 2, select: { url: true } },
  variants: {
    where: { isActive: true },
    select: { id: true, _count: { select: { attributes: true } } },
  },
} satisfies Prisma.ProductInclude;

export type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

/** Product rows → storefront cards (with live stock). Keeps the input order. */
export async function toProductCards(
  prisma: PrismaService,
  rows: CardRow[],
): Promise<StorefrontProductCard[]> {
  const stock = await availableByVariant(
    prisma,
    rows.flatMap((p) => p.variants.map((v) => v.id)),
  );
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: p.images[0]?.url ?? null,
    hoverImageUrl: p.images[1]?.url ?? null,
    price: Number(p.basePrice),
    compareAtPrice: p.compareAtPrice === null ? null : Number(p.compareAtPrice),
    currency: p.currency,
    brandName: p.brand?.name ?? null,
    vendor: p.vendor,
    ratingAverage: Number(p.ratingAverage),
    ratingCount: p.ratingCount,
    inStock: p.variants.some((v) => (stock.get(v.id) ?? 0) > 0),
    hasOptions: p.variants.some((v) => v._count.attributes > 0),
  }));
}

/** Loads cards for ids and returns them in the same order as `ids`. */
export async function cardsForIds(
  prisma: PrismaService,
  ids: string[],
): Promise<StorefrontProductCard[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { ...VISIBLE, id: { in: ids } },
    include: cardInclude,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return toProductCards(
    prisma,
    ids.map((id) => byId.get(id)).filter((r): r is CardRow => r !== undefined),
  );
}
