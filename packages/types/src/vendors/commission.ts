export const COMMISSION_SCOPES = ['GLOBAL', 'CATEGORY', 'VENDOR'] as const;
export type CommissionScopeValue = (typeof COMMISSION_SCOPES)[number];

export const COMMISSION_SCOPE_LABELS: Record<CommissionScopeValue, string> = {
  GLOBAL: 'Whole marketplace',
  CATEGORY: 'Category',
  VENDOR: 'Seller',
};

export interface CommissionRuleDto {
  id: string;
  scope: CommissionScopeValue;
  vendor: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  rate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GLOBAL: no seller, no category. CATEGORY: category only (applies to its sub-categories too).
 * VENDOR: seller, optionally narrowed to one category of that seller.
 */
export interface CommissionRuleInput {
  scope: CommissionScopeValue;
  vendorId?: string | null;
  categoryId?: string | null;
  rate: number;
  isActive?: boolean;
}

export type CommissionSource =
  | 'vendor_category'
  | 'vendor_rule'
  | 'category'
  | 'global'
  | 'default';

export const COMMISSION_SOURCE_LABELS: Record<CommissionSource, string> = {
  vendor_category: 'Seller rule for this category',
  vendor_rule: 'Seller rule',
  category: 'Category rule',
  global: 'Marketplace rule',
  default: 'Default setting (marketplace.defaultCommissionRate)',
};

export interface CommissionRuleLite {
  id: string;
  scope: CommissionScopeValue;
  vendorId: string | null;
  categoryId: string | null;
  rate: number;
  isActive: boolean;
}

export interface CommissionContext {
  vendorId: string;
  /** The product's category first, then its parent, grandparent… */
  categoryPath: string[];
  defaultRate: number;
}

export interface CommissionResolution {
  rate: number;
  source: CommissionSource;
  ruleId: string | null;
}

/**
 * Most specific wins:
 * seller+category rule (nearest category) → seller rule →
 * category rule (nearest category) → marketplace rule → default setting.
 */
export function resolveCommissionRate(
  rules: CommissionRuleLite[],
  ctx: CommissionContext,
): CommissionResolution {
  const active = rules.filter((r) => r.isActive);
  const hit = (r: CommissionRuleLite, source: CommissionSource): CommissionResolution => ({
    rate: r.rate,
    source,
    ruleId: r.id,
  });

  for (const categoryId of ctx.categoryPath) {
    const r = active.find(
      (x) => x.scope === 'VENDOR' && x.vendorId === ctx.vendorId && x.categoryId === categoryId,
    );
    if (r) return hit(r, 'vendor_category');
  }
  const vendorRule = active.find(
    (x) => x.scope === 'VENDOR' && x.vendorId === ctx.vendorId && !x.categoryId,
  );
  if (vendorRule) return hit(vendorRule, 'vendor_rule');
  for (const categoryId of ctx.categoryPath) {
    const r = active.find((x) => x.scope === 'CATEGORY' && x.categoryId === categoryId);
    if (r) return hit(r, 'category');
  }
  const global = active.find((x) => x.scope === 'GLOBAL');
  if (global) return hit(global, 'global');
  return { rate: ctx.defaultRate, source: 'default', ruleId: null };
}

/** Category id → its path to the root (self first). Guards against cycles. */
export function categoryPathOf(
  categoryId: string | null,
  parents: Map<string, string | null>,
): string[] {
  const path: string[] = [];
  let current = categoryId;
  while (current && !path.includes(current)) {
    path.push(current);
    current = parents.get(current) ?? null;
  }
  return path;
}

/** Returns a problem message, or null when the rule's shape fits its scope. */
export function commissionRuleProblem(input: CommissionRuleInput): string | null {
  if (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 100)
    return 'Rate must be between 0 and 100';
  if (input.scope === 'GLOBAL' && (input.vendorId || input.categoryId))
    return 'A marketplace rule has no seller or category';
  if (input.scope === 'CATEGORY' && (!input.categoryId || input.vendorId))
    return 'A category rule needs a category and no seller';
  if (input.scope === 'VENDOR' && !input.vendorId) return 'A seller rule needs a seller';
  return null;
}

export interface CommissionPreviewQuery {
  vendorId: string;
  categoryId?: string;
}

export interface CommissionPreviewDto extends CommissionResolution {
  label: string;
}
