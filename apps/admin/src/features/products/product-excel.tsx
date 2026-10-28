'use client';

import { useQueryClient } from '@tanstack/react-query';
import { PRODUCT_CSV_COLUMNS, type ProductCsvColumn } from '@ecommerce/types';
import { ExcelDownloadButton } from '@/components/excel/excel-download-button';
import { ExcelUploadButton } from '@/components/excel/excel-upload-button';
import { queryKeys, toolsApi } from '@/lib/api-client';
import { downloadExcel, excelFilename, type ExcelColumn } from '@/lib/excel';

/** Friendly Excel headers; each one normalises back to the product import column. */
const HEADERS: Record<ProductCsvColumn, { header: string; width: number; number?: boolean }> = {
  sku: { header: 'SKU', width: 18 },
  name: { header: 'Name', width: 36 },
  category: { header: 'Category', width: 20 },
  price: { header: 'Price', width: 11, number: true },
  compare_at_price: { header: 'Compare at price', width: 16, number: true },
  short_description: { header: 'Short description', width: 40 },
  description: { header: 'Description', width: 50 },
  weight_grams: { header: 'Weight grams', width: 13, number: true },
  status: { header: 'Status', width: 12 },
};
type Line = Record<ProductCsvColumn, string>;

const columns: ExcelColumn<Line>[] = PRODUCT_CSV_COLUMNS.map((c) => ({
  header: HEADERS[c].header,
  width: HEADERS[c].width,
  value: (r) => (HEADERS[c].number && r[c] !== '' ? Number(r[c]) : r[c]),
}));

/** Every product of the shop, one row per product (the same file works as the upload template). */
async function loadProducts(): Promise<Line[]> {
  const { rows } = await toolsApi.vendorProductsCsv();
  const [header = [], ...body] = rows;
  return body.map(
    (cells) =>
      Object.fromEntries(
        PRODUCT_CSV_COLUMNS.map((c) => [c, cells[header.indexOf(c)] ?? '']),
      ) as Line,
  );
}

/** Download / upload Excel on the product list. Uses the product import rules (drafts for new SKUs). */
export function ProductExcelTools() {
  const queryClient = useQueryClient();
  return (
    <>
      <ExcelDownloadButton name="products" columns={columns} load={loadProducts} />
      <ExcelUploadButton
        title="Upload products from Excel"
        keyLabel="SKU"
        requiredColumns={['sku']}
        onTemplate={async () =>
          downloadExcel(
            excelFilename('products-template'),
            columns,
            await loadProducts(),
            'Products',
          )
        }
        help={
          <ul className="list-disc space-y-0.5 pl-4">
            <li>
              Products are matched by <b>SKU</b>. A new SKU becomes a new <b>draft</b> product
              (needs Name, Category and Price) — publish it in Products when the photos are added.
            </li>
            <li>
              <b>Category</b> is the category&apos;s slug (see Categories, e.g.{' '}
              <code>gas-lifts</code>).
            </li>
            <li>Empty cells keep the current value. Status is not changed by uploads.</li>
            <li>
              Products with options (sizes, colours) are edited in the product page, not here.
            </li>
          </ul>
        }
        run={(rows, dryRun) => toolsApi.importVendorProducts({ rows, dryRun })}
        onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.products.all })}
      />
    </>
  );
}
