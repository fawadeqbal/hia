import { BadRequestException } from '@nestjs/common';
import { IMPORT_MAX_ROWS, type SheetRow } from '@ecommerce/types';

/**
 * Reading cells of an uploaded spreadsheet row. Every helper returns `undefined` for an empty cell
 * ("keep the current value") and pushes a human message into `problems` when the text is invalid.
 */

export const cellText = (row: SheetRow, key: string): string => (row[key] ?? '').trim();

export const isEmptyRow = (row: SheetRow): boolean =>
  Object.values(row).every((v) => (v ?? '').trim() === '');

/** Refuses an empty or too large upload before any row is checked. */
export function assertSheetSize(rows: SheetRow[], what = 'row'): void {
  if (!rows.some((r) => !isEmptyRow(r)))
    throw new BadRequestException(`The file has no ${what}s under the header row`);
  if (rows.length > IMPORT_MAX_ROWS)
    throw new BadRequestException(`At most ${IMPORT_MAX_ROWS} ${what}s per file`);
}

/** "1,250" → 1250. */
export function numberCell(
  row: SheetRow,
  key: string,
  label: string,
  problems: string[],
  opts: { min?: number; max?: number; integer?: boolean } = {},
): number | undefined {
  const text = cellText(row, key).replace(/,/g, '');
  if (text === '') return undefined;
  const n = Number(text);
  const { min, max, integer } = opts;
  if (!Number.isFinite(n) || (integer && !Number.isInteger(n))) {
    problems.push(`${label} must be ${integer ? 'a whole number' : 'a number'}`);
    return undefined;
  }
  if ((min !== undefined && n < min) || (max !== undefined && n > max)) {
    problems.push(
      max === undefined
        ? `${label} must be at least ${min}`
        : `${label} must be between ${min ?? 0} and ${max}`,
    );
    return undefined;
  }
  return n;
}

const YES = ['yes', 'y', 'true', '1', 'active', 'on'];
const NO = ['no', 'n', 'false', '0', 'inactive', 'off', 'hidden'];

/** yes / no, true / false, 1 / 0, active / inactive. */
export function booleanCell(
  row: SheetRow,
  key: string,
  label: string,
  problems: string[],
): boolean | undefined {
  const text = cellText(row, key).toLowerCase();
  if (text === '') return undefined;
  if (YES.includes(text)) return true;
  if (NO.includes(text)) return false;
  problems.push(`${label} must be yes or no`);
  return undefined;
}

/** 2026-11-01, 2026-11-01 10:30 or 01/11/2026 (day first), in server time → ISO string. */
export function dateCell(
  row: SheetRow,
  key: string,
  label: string,
  problems: string[],
): string | undefined {
  const text = cellText(row, key);
  if (text === '') return undefined;
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(text);
  const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(text);
  const parts = ymd
    ? [ymd[1], ymd[2], ymd[3], ymd[4], ymd[5]]
    : dmy
      ? [dmy[3], dmy[2], dmy[1], dmy[4], dmy[5]]
      : null;
  const date = parts
    ? new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2]),
        Number(parts[3] ?? 0),
        Number(parts[4] ?? 0),
      )
    : new Date(NaN);
  if (Number.isNaN(date.getTime())) {
    problems.push(`${label} must be a date like 2026-11-01`);
    return undefined;
  }
  return date.toISOString();
}
