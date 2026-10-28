import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Units that can be sold now per variant: Σ(on hand − reserved) over active warehouses.
 * Used by the storefront, cart and (later) checkout so they always agree.
 */
export async function availableByVariant(
  prisma: PrismaService,
  variantIds: string[],
): Promise<Map<string, number>> {
  const ids = [...new Set(variantIds)];
  if (ids.length === 0) return new Map();
  const rows = await prisma.stockLevel.groupBy({
    by: ['variantId'],
    where: { variantId: { in: ids }, warehouse: { isActive: true } },
    _sum: { quantity: true, reserved: true },
  });
  const byId = new Map(
    rows.map((r) => [r.variantId, (r._sum.quantity ?? 0) - (r._sum.reserved ?? 0)]),
  );
  return new Map(ids.map((id) => [id, Math.max(0, byId.get(id) ?? 0)]));
}
