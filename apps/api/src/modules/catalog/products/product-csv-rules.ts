import { SKU_REGEX, type ProductCsvColumn, type SheetRow } from '@ecommerce/types';

export interface CsvRow {
  sku: string;
  name?: string;
  category?: string;
  price?: number;
  compareAtPrice?: number | null;
  shortDescription?: string;
  description?: string;
  weightGrams?: number | null;
}

const num = (v: string): number | null => {
  const t = v.replace(/,/g, '').trim();
  return t === '' ? null : Number(t);
};

/**
 * One uploaded row → typed row, or problems. Empty cells mean "leave unchanged" on update
 * (create needs sku, name, category, price).
 */
export function readRow(sheet: SheetRow): { row: CsvRow; problems: string[] } {
  const get = (c: ProductCsvColumn) => (sheet[c] ?? '').trim();
  const problems: string[] = [];
  const row: CsvRow = { sku: get('sku') };
  if (!row.sku) problems.push('sku is empty');
  else if (!SKU_REGEX.test(row.sku) || row.sku.length > 64)
    problems.push(`sku "${row.sku}" has invalid characters`);
  const name = get('name');
  if (name) {
    if (name.length < 3 || name.length > 200) problems.push('name must be 3–200 characters');
    row.name = name;
  }
  if (get('category')) row.category = get('category').toLowerCase();
  const price = num(get('price'));
  if (price !== null) {
    if (!Number.isFinite(price) || price <= 0) problems.push('price must be a number above 0');
    row.price = price;
  }
  const compare = num(get('compare_at_price'));
  if (compare !== null) {
    if (!Number.isFinite(compare) || compare < 0)
      problems.push('compare_at_price must be a number');
    row.compareAtPrice = compare === 0 ? null : compare;
    if (row.price !== undefined && row.compareAtPrice !== null && row.compareAtPrice! <= row.price)
      problems.push('compare_at_price must be higher than price');
  }
  if (get('short_description')) row.shortDescription = get('short_description').slice(0, 300);
  if (get('description')) row.description = get('description');
  const weight = num(get('weight_grams'));
  if (weight !== null) {
    if (!Number.isInteger(weight) || weight < 0) problems.push('weight_grams must be whole grams');
    row.weightGrams = weight;
  }
  return { row, problems };
}

/** Fields a new product needs. */
export function createProblems(row: CsvRow): string[] {
  const missing = (['name', 'category', 'price'] as const).filter((k) => row[k] === undefined);
  return missing.length ? [`new product needs ${missing.join(', ')}`] : [];
}

/** What the product has now (for "no change" detection). */
export interface ProductNow {
  name: string;
  category: string;
  price: number;
  compareAtPrice: number | null;
  shortDescription: string | null;
  description: string | null;
  weightGrams: number | null;
}

/** Labels of the fields the row would change (empty cells are not changes). */
export function changedFields(row: CsvRow, now: ProductNow): string[] {
  const out: string[] = [];
  if (row.name !== undefined && row.name !== now.name) out.push('name');
  if (row.category !== undefined && row.category !== now.category) out.push('category');
  if (row.price !== undefined && row.price !== now.price) out.push('price');
  if (row.compareAtPrice !== undefined && row.compareAtPrice !== now.compareAtPrice)
    out.push('compare at price');
  if (row.shortDescription !== undefined && row.shortDescription !== (now.shortDescription ?? ''))
    out.push('short description');
  if (row.description !== undefined && row.description !== (now.description ?? ''))
    out.push('description');
  if (row.weightGrams !== undefined && row.weightGrams !== now.weightGrams) out.push('weight');
  return out;
}
