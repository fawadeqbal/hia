import {
  emptyImportResult,
  pushImportRow,
  type ImportResult,
  type SheetRow,
  type StockImportMode,
} from '@ecommerce/types';
import { cellText, isEmptyRow, numberCell } from '../../common/utils/sheet-cells';

/** What the shop has now for one SKU in the chosen warehouse. */
export interface StockNow {
  variantId: string;
  quantity: number;
  reserved: number;
  lowStockThreshold: number;
}

/** One change to save (only rows that really change something). */
export interface StockImportChange {
  variantId: string;
  sku: string;
  delta: number;
  lowStockThreshold?: number;
}

const MAX_QUANTITY = 1_000_000;

/**
 * Checks every row of a stock upload and works out the changes. Pure (no Prisma) so it is unit-tested.
 * replace: quantity = new on-hand count · add: quantity = units that arrived.
 * Stock can never go below what is reserved for open orders.
 */
export function planStockImport(
  rows: SheetRow[],
  bySku: Map<string, StockNow>,
  mode: StockImportMode,
  dryRun: boolean,
): { result: ImportResult; changes: StockImportChange[] } {
  const result = emptyImportResult(dryRun);
  const changes: StockImportChange[] = [];
  const seen = new Set<string>();

  rows.forEach((row, i) => {
    if (isEmptyRow(row)) return;
    const line = i + 2;
    const sku = cellText(row, 'sku');
    const problems: string[] = [];
    if (!sku) problems.push('SKU is empty');
    const key = sku.toLowerCase();
    if (sku && seen.has(key)) problems.push('this SKU is in the file twice');
    seen.add(key);
    const now = sku ? bySku.get(key) : undefined;
    if (sku && !now) problems.push('no product has this SKU');

    const quantity = numberCell(row, 'quantity', 'Quantity', problems, {
      integer: true,
      min: 0,
      max: MAX_QUANTITY,
    });
    const threshold = numberCell(row, 'low_stock_alert', 'Low stock alert', problems, {
      integer: true,
      min: 0,
      max: 100_000,
    });

    if (problems.length || !now) {
      pushImportRow(result, { line, key: sku, action: 'error', message: problems.join('; ') });
      return;
    }

    const target =
      quantity === undefined
        ? now.quantity
        : mode === 'replace'
          ? quantity
          : now.quantity + quantity;
    if (target > MAX_QUANTITY) {
      pushImportRow(result, {
        line,
        key: sku,
        action: 'error',
        message: `stock would be more than ${MAX_QUANTITY.toLocaleString('en-US')}`,
      });
      return;
    }
    if (target < now.reserved) {
      pushImportRow(result, {
        line,
        key: sku,
        action: 'error',
        message: `stock cannot go below the ${now.reserved} units reserved for orders`,
      });
      return;
    }

    const delta = target - now.quantity;
    const thresholdChanged = threshold !== undefined && threshold !== now.lowStockThreshold;
    if (delta === 0 && !thresholdChanged) {
      pushImportRow(result, { line, key: sku, action: 'unchanged', message: null });
      return;
    }
    const notes: string[] = [];
    if (delta !== 0) notes.push(`Stock ${now.quantity} → ${target}`);
    if (thresholdChanged) notes.push(`Low stock alert ${now.lowStockThreshold} → ${threshold}`);
    changes.push({
      variantId: now.variantId,
      sku,
      delta,
      ...(thresholdChanged ? { lowStockThreshold: threshold } : {}),
    });
    pushImportRow(result, { line, key: sku, action: 'update', message: notes.join(' · ') });
  });

  return { result, changes };
}
