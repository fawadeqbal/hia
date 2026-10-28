import { planStockImport, type StockNow } from './stock-import-rules';

const stock = new Map<string, StockNow>([
  ['hia-wh-60', { variantId: 'v1', quantity: 10, reserved: 2, lowStockThreshold: 5 }],
  ['hia-gl-4', { variantId: 'v2', quantity: 0, reserved: 0, lowStockThreshold: 5 }],
]);

describe('stock upload', () => {
  it('replace: the quantity becomes the new stock', () => {
    const { result, changes } = planStockImport(
      [{ sku: 'HIA-WH-60', quantity: '50' }],
      stock,
      'replace',
      true,
    );
    expect(changes).toEqual([{ variantId: 'v1', sku: 'HIA-WH-60', delta: 40 }]);
    expect(result).toMatchObject({ dryRun: true, updated: 1, errors: 0 });
    expect(result.rows[0]).toMatchObject({ line: 2, action: 'update', message: 'Stock 10 → 50' });
  });

  it('add: the quantity is added to the stock', () => {
    const { changes } = planStockImport([{ sku: 'hia-wh-60', quantity: '5' }], stock, 'add', true);
    expect(changes[0]?.delta).toBe(5);
  });

  it('skips empty rows, keeps the stock when the cell is empty, changes only the alert', () => {
    const { result, changes } = planStockImport(
      [
        { sku: '', quantity: '' },
        { sku: 'HIA-GL-4', quantity: '', low_stock_alert: '3' },
      ],
      stock,
      'replace',
      true,
    );
    expect(changes).toEqual([{ variantId: 'v2', sku: 'HIA-GL-4', delta: 0, lowStockThreshold: 3 }]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ line: 3, message: 'Low stock alert 5 → 3' });
  });

  it('marks rows with nothing to change as unchanged', () => {
    const { result, changes } = planStockImport(
      [{ sku: 'HIA-WH-60', quantity: '10', low_stock_alert: '5' }],
      stock,
      'replace',
      true,
    );
    expect(changes).toEqual([]);
    expect(result.unchanged).toBe(1);
  });

  it('reports unknown SKUs, duplicates, bad numbers and reserved stock', () => {
    const { result, changes } = planStockImport(
      [
        { sku: 'NOPE', quantity: '1' },
        { sku: 'HIA-GL-4', quantity: '2.5' },
        { sku: 'HIA-WH-60', quantity: '1' },
        { sku: 'hia-wh-60', quantity: '3' },
      ],
      stock,
      'replace',
      true,
    );
    expect(changes).toEqual([]);
    expect(result.errors).toBe(4);
    expect(result.rows.map((r) => r.message)).toEqual([
      'no product has this SKU',
      'Quantity must be a whole number',
      'stock cannot go below the 2 units reserved for orders',
      'this SKU is in the file twice',
    ]);
  });
});
