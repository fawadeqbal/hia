import {
  DISCOUNT_TYPE_LABELS,
  emptyImportResult,
  normalizeCouponCode,
  pushImportRow,
  type CouponInput,
  type DiscountType,
  type ImportResult,
  type SheetRow,
} from '@ecommerce/types';
import {
  booleanCell,
  cellText,
  dateCell,
  isEmptyRow,
  numberCell,
} from '../../common/utils/sheet-cells';

export const COUPON_CODE_REGEX = /^[A-Z0-9_-]{3,30}$/;

/** Rules shared by the coupon form (API) and the Excel upload. Empty = valid. */
export function couponProblems(
  c: Pick<CouponInput, 'discountType' | 'value' | 'startsAt' | 'endsAt'>,
): string[] {
  const out: string[] = [];
  if (c.discountType === 'PERCENTAGE' && (c.value <= 0 || c.value > 100))
    out.push('Percentage must be between 1 and 100');
  if (c.discountType === 'FIXED_AMOUNT' && c.value <= 0) out.push('Enter an amount');
  if (c.startsAt && c.endsAt && new Date(c.endsAt) <= new Date(c.startsAt))
    out.push('The end must be after the start');
  return out;
}

const TYPE_WORDS: Record<string, DiscountType> = {
  percentage: 'PERCENTAGE',
  percent: 'PERCENTAGE',
  '%': 'PERCENTAGE',
  fixed: 'FIXED_AMOUNT',
  fixedamount: 'FIXED_AMOUNT',
  amount: 'FIXED_AMOUNT',
  freedelivery: 'FREE_SHIPPING',
  freeshipping: 'FREE_SHIPPING',
  free: 'FREE_SHIPPING',
};
for (const [type, label] of Object.entries(DISCOUNT_TYPE_LABELS))
  TYPE_WORDS[label.toLowerCase().replace(/[\s_-]+/g, '')] = type as DiscountType;

function discountType(row: SheetRow, problems: string[]): DiscountType | undefined {
  const text = cellText(row, 'type')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (!text) return undefined;
  const type = TYPE_WORDS[text];
  if (!type) problems.push('Type must be Percentage, Fixed amount or Free delivery');
  return type;
}

export interface CouponNow extends CouponInput {
  id: string;
}

export type CouponImportChange =
  { kind: 'create'; input: CouponInput } | { kind: 'update'; id: string; input: CouponInput };

/** Empty cell = keep `current`; 0 in Min order / Max discount / limits = "none". */
const orNone = (n: number | undefined, current: number | null): number | null =>
  n === undefined ? current : n === 0 ? null : n;

const FIELDS: (keyof CouponInput)[] = [
  'description',
  'discountType',
  'value',
  'minOrderTotal',
  'maxDiscount',
  'usageLimit',
  'usageLimitPerCustomer',
  'startsAt',
  'endsAt',
  'isActive',
];

/**
 * Checks a coupon upload. Rows are matched by code; empty cells keep the current value (a new coupon
 * needs a type and, unless it is free delivery, a value). Product / category limits are kept as they are
 * (new coupons apply to every product). Pure (no Prisma) so it is unit-tested.
 */
export function planCouponImport(
  rows: SheetRow[],
  existing: CouponNow[],
  dryRun: boolean,
): { result: ImportResult; changes: CouponImportChange[] } {
  const result = emptyImportResult(dryRun);
  const changes: CouponImportChange[] = [];
  const byCode = new Map(existing.map((c) => [c.code, c]));
  const seen = new Set<string>();

  rows.forEach((row, i) => {
    if (isEmptyRow(row)) return;
    const line = i + 2;
    const problems: string[] = [];
    const code = normalizeCouponCode(cellText(row, 'code'));
    if (!code) problems.push('Code is empty');
    else if (!COUPON_CODE_REGEX.test(code)) problems.push('Code: 3–30 letters, numbers, - or _');
    if (code && seen.has(code)) problems.push('this code is in the file twice');
    seen.add(code);
    const now = byCode.get(code);

    const description = cellText(row, 'description');
    if (description.length > 200) problems.push('Description is longer than 200 characters');
    const type = discountType(row, problems);
    const value = numberCell(row, 'value', 'Value', problems, { min: 0 });
    const minOrder = numberCell(row, 'min_order', 'Min order', problems, { min: 0 });
    const maxDiscount = numberCell(row, 'max_discount', 'Max discount', problems, { min: 0 });
    const usageLimit = numberCell(row, 'usage_limit', 'Usage limit', problems, {
      integer: true,
      min: 0,
    });
    const perCustomer = numberCell(row, 'per_customer_limit', 'Per customer limit', problems, {
      integer: true,
      min: 0,
    });
    const startsAt = dateCell(row, 'starts', 'Starts', problems);
    const endsAt = dateCell(row, 'ends', 'Ends', problems);
    const isActive = booleanCell(row, 'active', 'Active', problems);

    if (!now && !type && code) problems.push('Type is needed for a new coupon');
    if (!now && type && type !== 'FREE_SHIPPING' && value === undefined)
      problems.push('Value is needed for a new coupon');

    const base: CouponInput = now
      ? withoutId(now)
      : {
          code,
          description: null,
          discountType: type ?? 'PERCENTAGE',
          value: 0,
          minOrderTotal: null,
          maxDiscount: null,
          usageLimit: null,
          usageLimitPerCustomer: null,
          categoryIds: [],
          productIds: [],
          startsAt: null,
          endsAt: null,
          isActive: true,
        };
    const next: CouponInput = {
      code,
      description: description || base.description,
      discountType: type ?? base.discountType,
      value: value ?? base.value,
      minOrderTotal: orNone(minOrder, base.minOrderTotal),
      maxDiscount: orNone(maxDiscount, base.maxDiscount),
      usageLimit: orNone(usageLimit, base.usageLimit),
      usageLimitPerCustomer: orNone(perCustomer, base.usageLimitPerCustomer),
      categoryIds: base.categoryIds,
      productIds: base.productIds,
      startsAt: startsAt ?? base.startsAt,
      endsAt: endsAt ?? base.endsAt,
      isActive: isActive ?? base.isActive,
    };
    if (next.discountType === 'FREE_SHIPPING') next.value = 0;
    if (next.discountType !== 'PERCENTAGE') next.maxDiscount = null;
    if (!problems.length) problems.push(...couponProblems(next));

    if (problems.length) {
      pushImportRow(result, { line, key: code, action: 'error', message: problems.join('; ') });
      return;
    }
    if (!now) {
      changes.push({ kind: 'create', input: next });
      pushImportRow(result, { line, key: code, action: 'create', message: 'New coupon' });
      return;
    }
    const same = (a: unknown, b: unknown) =>
      a === b || (typeof a === 'string' && typeof b === 'string' && +new Date(a) === +new Date(b));
    const changed = FIELDS.filter((f) => !same(next[f], now[f]));
    if (!changed.length) {
      pushImportRow(result, { line, key: code, action: 'unchanged', message: null });
      return;
    }
    changes.push({ kind: 'update', id: now.id, input: next });
    pushImportRow(result, {
      line,
      key: code,
      action: 'update',
      message: `Change ${changed.map(label).join(', ')}`,
    });
  });

  return { result, changes };
}

const LABELS: Partial<Record<keyof CouponInput, string>> = {
  discountType: 'type',
  minOrderTotal: 'min order',
  maxDiscount: 'max discount',
  usageLimit: 'usage limit',
  usageLimitPerCustomer: 'per customer limit',
  startsAt: 'start',
  endsAt: 'end',
  isActive: 'active',
};
const label = (f: keyof CouponInput) => LABELS[f] ?? f;

const withoutId = ({ id: _id, ...input }: CouponNow): CouponInput => input;
