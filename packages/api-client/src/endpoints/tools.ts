import type {
  CsvExportDto,
  ManualOrderInput,
  ManualOrderResult,
  ProductImportInput,
  ProductImportResult,
  ReorderResult,
} from '@ecommerce/types';
import { api } from '../http';

/** Buy again, staff manual orders, product CSV import / export. */
export const toolsApi = {
  reorder: (orderNumber: string) =>
    api<ReorderResult>(`/orders/${encodeURIComponent(orderNumber)}/reorder`, {
      method: 'POST',
      body: {},
    }),
  manualOrder: (body: ManualOrderInput) =>
    api<ManualOrderResult>('/admin/manual-orders', { method: 'POST', body }),
  vendorProductsCsv: () => api<CsvExportDto>('/vendor/products-csv'),
  importVendorProducts: (body: ProductImportInput) =>
    api<ProductImportResult>('/vendor/products-csv/import', { method: 'POST', body }),
  adminProductsCsv: () => api<CsvExportDto>('/admin/products-csv'),
};
