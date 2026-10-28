'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { StockFilter, StockImportMode, StockRow } from '@ecommerce/types';
import { ExcelDownloadButton } from '@/components/excel/excel-download-button';
import { ExcelUploadButton } from '@/components/excel/excel-upload-button';
import { inventoryApi, queryKeys } from '@/lib/api-client';
import { downloadExcel, fetchAllPages, type ExcelColumn } from '@/lib/excel';

const STATUS: Record<StockRow['status'], string> = {
  in_stock: 'In stock',
  low: 'Low stock',
  out: 'Out of stock',
};

const info: ExcelColumn<StockRow>[] = [
  { header: 'SKU', value: (r) => r.sku, width: 18 },
  { header: 'Product', value: (r) => r.productName, width: 36 },
  { header: 'Option', value: (r) => r.variantName ?? '', width: 16 },
];
/** Download: everything on the stock page. */
const listColumns: ExcelColumn<StockRow>[] = [
  ...info,
  { header: 'Quantity', value: (r) => r.quantity, width: 11 },
  { header: 'Reserved', value: (r) => r.reserved, width: 11 },
  { header: 'Available', value: (r) => r.available, width: 11 },
  { header: 'Low stock alert', value: (r) => r.lowStockThreshold, width: 16 },
  { header: 'Status', value: (r) => STATUS[r.status], width: 14 },
];

const MODES: { value: StockImportMode; title: string; text: string }[] = [
  {
    value: 'replace',
    title: 'Replace',
    text: 'I counted the stock — Quantity becomes the new stock.',
  },
  {
    value: 'add',
    title: 'Add',
    text: 'New stock arrived — Quantity is added to the current stock.',
  },
];

/** Download / upload Excel on the stock page. */
export function StockExcelTools({
  warehouseId,
  filter,
  search,
}: {
  warehouseId: string;
  filter: StockFilter;
  search?: string;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<StockImportMode>('replace');
  const all = (params: { filter: StockFilter; search?: string }) =>
    fetchAllPages((page, limit) => inventoryApi.stock({ warehouseId, ...params, page, limit }));

  return (
    <>
      <ExcelDownloadButton
        name={filter === 'all' ? 'stock' : `stock-${filter}`}
        columns={listColumns}
        load={() => all({ filter, search })}
      />
      <ExcelUploadButton
        title="Upload stock from Excel"
        keyLabel="SKU"
        requiredColumns={['sku', 'quantity']}
        optionsKey={mode}
        onTemplate={async () => {
          const rows = await all({ filter: 'all' });
          await downloadExcel(
            mode === 'replace' ? 'stock-count-template.xlsx' : 'stock-arrived-template.xlsx',
            [
              ...info,
              // Add: start empty, type only what arrived. Replace: today's stock, change what you counted.
              {
                header: 'Quantity',
                value: (r) => (mode === 'replace' ? r.quantity : ''),
                width: 11,
              },
              { header: 'Low stock alert', value: (r) => r.lowStockThreshold, width: 16 },
            ],
            rows,
            'Stock',
          );
        }}
        help={
          <ul className="list-disc space-y-0.5 pl-4">
            <li>
              Products are matched by <b>SKU</b>. Do not change the SKU column.
            </li>
            <li>
              <b>Quantity</b>: {mode === 'replace' ? 'the stock you counted' : 'how many arrived'}.
              Leave it empty to keep a product as it is.
            </li>
            <li>
              <b>Low stock alert</b> (optional): you get an email when stock falls to this number.
            </li>
            <li>Product and Option are only there to help you; they are not changed.</li>
          </ul>
        }
        options={
          <fieldset>
            <legend className="mb-1.5 text-gray-600">How should Quantity be used?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODES.map((m) => (
                <label
                  key={m.value}
                  className={`flex cursor-pointer gap-2 rounded-lg border p-3 ${
                    mode === m.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="stock-mode"
                    className="mt-0.5"
                    checked={mode === m.value}
                    onChange={() => setMode(m.value)}
                  />
                  <span>
                    <b className="block text-gray-900">{m.title}</b>
                    <span className="text-gray-600">{m.text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        }
        run={(rows, dryRun) => inventoryApi.importStock({ rows, dryRun, mode, warehouseId })}
        onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })}
      />
    </>
  );
}
