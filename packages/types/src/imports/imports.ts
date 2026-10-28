// Excel / CSV upload ("import") — shared by the API and the admin panel.
//
// The admin panel reads the file, turns every row into { column: text } using the header row
// (normalised with normalizeSheetHeader), and sends the rows as JSON. The API checks every row
// (dryRun = true → preview, nothing saved) and saves only when the whole file is valid.
// An empty cell always means "keep the current value".

/** One spreadsheet row: normalised header → cell text (trimmed, '' when empty). */
export type SheetRow = Record<string, string>;

export const IMPORT_MAX_ROWS = 2000;

/** "Low stock alert" / "low-stock alert" / "LOW_STOCK_ALERT" → "low_stock_alert". */
export function normalizeSheetHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export type ImportAction = 'create' | 'update' | 'unchanged' | 'error';

export interface ImportRowResult {
  /** Line in the file (the header is line 1). */
  line: number;
  /** What identifies the row: SKU, slug or coupon code. */
  key: string;
  action: ImportAction;
  /** What changes ("Stock 12 → 50") or what is wrong. */
  message: string | null;
}

export interface ImportResult {
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  rows: ImportRowResult[];
}

export interface ImportRowsInput {
  rows: SheetRow[];
  /** true = check only (preview). */
  dryRun: boolean;
}

/** An empty result to add rows to. */
export function emptyImportResult(dryRun: boolean): ImportResult {
  return { dryRun, created: 0, updated: 0, unchanged: 0, errors: 0, rows: [] };
}

/** Adds a row and counts it. */
export function pushImportRow(result: ImportResult, row: ImportRowResult): void {
  result.rows.push(row);
  if (row.action === 'create') result.created++;
  else if (row.action === 'update') result.updated++;
  else if (row.action === 'unchanged') result.unchanged++;
  else result.errors++;
}

// ------------------------------------------------------------------ stock

/** replace = "I counted 50" (stock becomes 50) · add = "50 arrived" (stock goes up by 50). */
export const STOCK_IMPORT_MODES = ['replace', 'add'] as const;
export type StockImportMode = (typeof STOCK_IMPORT_MODES)[number];

export interface StockImportInput extends ImportRowsInput {
  mode: StockImportMode;
  /** Defaults to the main warehouse. */
  warehouseId?: string;
}

/** Columns the stock upload reads (others, like Product or Available, are ignored). */
export const STOCK_IMPORT_COLUMNS = ['sku', 'quantity', 'low_stock_alert'] as const;

// ------------------------------------------------------------------ categories

export const CATEGORY_IMPORT_COLUMNS = [
  'slug',
  'name',
  'parent',
  'description',
  'position',
  'active',
] as const;

// ------------------------------------------------------------------ coupons

export const COUPON_IMPORT_COLUMNS = [
  'code',
  'description',
  'type',
  'value',
  'min_order',
  'max_discount',
  'usage_limit',
  'per_customer_limit',
  'starts',
  'ends',
  'active',
] as const;
