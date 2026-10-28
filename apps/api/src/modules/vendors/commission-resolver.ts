import {
  categoryPathOf,
  resolveCommissionRate,
  type CommissionResolution,
  type CommissionRuleLite,
  type CommissionScopeValue,
} from '@ecommerce/types';
import type { PrismaService } from '../../prisma/prisma.service';

/** Where-clause of a seller's own rule: scope VENDOR, no category, active. */
export const sellerRuleWhere = (vendorId: string) => ({
  scope: 'VENDOR' as const,
  vendorId,
  categoryId: null,
  isActive: true,
});

/** Sets (number) or removes (null) the seller's own commission rule. */
export async function setSellerRate(
  prisma: PrismaService,
  vendorId: string,
  rate: number | null,
): Promise<void> {
  const current = await prisma.commissionRule.findFirst({ where: sellerRuleWhere(vendorId) });
  if (rate === null) {
    if (current) await prisma.commissionRule.delete({ where: { id: current.id } });
  } else if (current) {
    await prisma.commissionRule.update({ where: { id: current.id }, data: { rate } });
  } else {
    await prisma.commissionRule.create({ data: { scope: 'VENDOR', vendorId, rate } });
  }
}

export type CommissionResolver = (args: {
  vendorId: string;
  categoryId: string | null;
}) => CommissionResolution;

/** Loads active rules and the category tree once, then resolves rates in memory. */
export async function loadCommissionResolver(
  prisma: PrismaService,
  defaultRate: number,
): Promise<CommissionResolver> {
  const [rows, categories] = await Promise.all([
    prisma.commissionRule.findMany({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } }),
    prisma.category.findMany({ select: { id: true, parentId: true } }),
  ]);
  const rules: CommissionRuleLite[] = rows.map((r) => ({
    id: r.id,
    scope: r.scope as CommissionScopeValue,
    vendorId: r.vendorId,
    categoryId: r.categoryId,
    rate: Number(r.rate),
    isActive: r.isActive,
  }));
  const parents = new Map(categories.map((c) => [c.id, c.parentId]));
  return ({ vendorId, categoryId }) =>
    resolveCommissionRate(rules, {
      vendorId,
      categoryPath: categoryPathOf(categoryId, parents),
      defaultRate,
    });
}
