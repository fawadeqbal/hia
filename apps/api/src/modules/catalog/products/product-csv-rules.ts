import { PRODUCT_CSV_COLUMNS, SKU_REGEX, TAX_CLASSES } from '@ecommerce/types';

export interface CsvRow {
  sku: string;
  name?: string;
  category?: string;
  brand?: string;
  price?: number;
  compareAtPrice?: number | null;
  shortDescription?: string;
  description?: string;
  weightGrams?: number | null;
  taxClass?: string;
}

/** Header → column index (case-insensitive, spaces / dashes = underscores). Missing required columns are listed. */
export function mapHeader(header: string[]): { index: Map<string, number>; missing: string[] } {
  const index = new Map<string, number>();
  header.forEach((h, i) =>
    index.set(
      h
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_'),
      i,
    ),
  );
  const missing = ['sku'].filter((c) => !index.has(c));
  return { index, missing };
}

const num = (v: string): number | null => {
  const t = v.replace(/,/g, '').trim();
  return t === '' ? null : Number(t);
};

/**
 * One CSV line → typed row, or problems. Empty cells mean "leave unchanged" on update
 * (create needs sku, name, category, price).
 */
export function readRow(
  cells: string[],
  index: Map<string, number>,
): { row: CsvRow; problems: string[] } {
  const get = (c: (typeof PRODUCT_CSV_COLUMNS)[number]) =>
    index.has(c) ? (cells[index.get(c)!] ?? '').trim() : '';
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
  if (get('brand')) row.brand = get('brand').toLowerCase();
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
  const tax = get('tax_class').toLowerCase();
  if (tax) {
    if (!(TAX_CLASSES as readonly string[]).includes(tax))
      problems.push(`tax_class must be one of ${TAX_CLASSES.join(', ')}`);
    row.taxClass = tax;
  }
  return { row, problems };
}

/** Fields a new product needs. */
export function createProblems(row: CsvRow): string[] {
  const missing = (['name', 'category', 'price'] as const).filter((k) => row[k] === undefined);
  return missing.length ? [`new product needs ${missing.join(', ')}`] : [];
}
