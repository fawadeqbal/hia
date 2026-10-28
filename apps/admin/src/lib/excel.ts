import { normalizeSheetHeader, parseCsv, type Paginated, type SheetRow } from '@ecommerce/types';

/**
 * Excel download / upload helpers for every admin list.
 * The Excel libraries are loaded only when a button is clicked, so pages stay light.
 */

export type ExcelValue = string | number | boolean | null | undefined;

export interface ExcelColumn<T> {
  /** Header text. For uploads it must normalise to the import column ("Low stock alert" → low_stock_alert). */
  header: string;
  value: (row: T) => ExcelValue;
  /** Width in characters (default 16). */
  width?: number;
}

/** Writes rows to an .xlsx file and starts the download. */
export async function downloadExcel<T>(
  filename: string,
  columns: ExcelColumn<T>[],
  rows: T[],
  sheet = 'Sheet1',
): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const data = [
    columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const })),
    ...rows.map((r) =>
      columns.map((c) => {
        const v = c.value(r);
        return v === undefined || v === '' ? null : v;
      }),
    ),
  ];
  await writeXlsxFile(data, {
    sheet: sheet.slice(0, 31),
    stickyRowsCount: 1,
    columns: columns.map((c) => ({ width: c.width ?? 16 })),
  }).toFile(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-01" or "2026-11-01 10:30" in the viewer's time. Dates go to Excel as text so nothing shifts. */
export function excelDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

export const yesNo = (v: boolean | null | undefined): string => (v ? 'Yes' : 'No');

function cellToText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    // Excel dates have no time zone: the library returns them as UTC wall-clock time.
    const day = `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
    const time =
      v.getUTCHours() || v.getUTCMinutes()
        ? ` ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`
        : '';
    return day + time;
  }
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v).trim();
}

/**
 * Reads the first sheet of an .xlsx (or a .csv) file into rows keyed by the normalised header.
 * Numbers stay exactly as written (no rounding). Line numbers in API results = index + 2.
 */
export async function readSpreadsheet(file: File): Promise<SheetRow[]> {
  let table: unknown[][];
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    table = parseCsv(await file.text());
  } else if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    table = (await readSheet(file, { parseNumber: (s: string) => s })) as unknown[][];
  } else {
    throw new Error('Choose an Excel (.xlsx) or CSV file');
  }
  const [header, ...body] = table;
  if (!header || header.length === 0) throw new Error('The file is empty');
  const keys = header.map((h) => normalizeSheetHeader(cellToText(h)));
  if (!keys.some(Boolean)) throw new Error('The first row must contain the column names');
  return body.map((cells) => {
    const row: SheetRow = {};
    keys.forEach((k, i) => {
      if (k) row[k] = cellToText(cells[i]);
    });
    return row;
  });
}

/** Loads every page of a list (for "Download Excel"), 100 rows per request. */
export async function fetchAllPages<T>(
  load: (page: number, limit: number) => Promise<Paginated<T>>,
  max = 10_000,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const res = await load(page, 100);
    items.push(...res.items);
    if (page >= res.meta.totalPages || items.length >= max || res.items.length === 0) break;
  }
  return items;
}

/** "orders-2026-10-28.xlsx" */
export const excelFilename = (name: string) =>
  `${name}-${excelDate(new Date().toISOString())}.xlsx`;
