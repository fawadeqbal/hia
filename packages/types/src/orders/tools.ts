import type { ShippingAddress } from '../users/address';

// ------------------------------------------------------------------ product CSV (seller import / export, admin export)
/** Column order of the product CSV. Import reads them by header name, so extra / reordered columns are fine. */
export const PRODUCT_CSV_COLUMNS = [
  'sku',
  'name',
  'category',
  'brand',
  'price',
  'compare_at_price',
  'short_description',
  'description',
  'weight_grams',
  'tax_class',
  'status',
] as const;
export type ProductCsvColumn = (typeof PRODUCT_CSV_COLUMNS)[number];
export const PRODUCT_IMPORT_MAX_ROWS = 1000;

export interface ProductImportInput {
  csv: string;
  /** Check every row without saving. */
  dryRun: boolean;
}

export interface ProductImportRow {
  line: number;
  sku: string;
  action: 'create' | 'update' | 'error';
  message: string | null;
}

export interface ProductImportResult {
  dryRun: boolean;
  created: number;
  updated: number;
  errors: number;
  rows: ProductImportRow[];
}

/** Header + rows, ready for a CSV download. */
export interface CsvExportDto {
  filename: string;
  rows: string[][];
}

/**
 * Minimal RFC 4180 CSV parser (quotes, escaped quotes, commas / newlines inside quotes, CRLF).
 * Shared by the API (import) and the UI (preview).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// ------------------------------------------------------------------ buy again
export interface ReorderResult {
  added: number;
  /** Items that could not be added (no longer sold / out of stock), with the reason. */
  skipped: { name: string; reason: string }[];
}

// ------------------------------------------------------------------ manual orders (staff)
export interface ManualOrderInput {
  email: string;
  items: { variantId: string; quantity: number }[];
  address: ShippingAddress;
  customerNote?: string | null;
  /** Internal note saved on the order. */
  staffNote?: string | null;
}

export interface ManualOrderResult {
  orderId: string;
  orderNumber: string;
  /** The order was linked to an existing customer account with this email. */
  linkedToAccount: boolean;
}
