import type {
  AdminAttention,
  AdminSalesReport,
  ReportRangeQuery,
  VendorAttention,
  VendorSalesReport,
} from '@ecommerce/types';
import { api } from '../http';

function rangeQuery(q: ReportRangeQuery): string {
  const qs = new URLSearchParams();
  if (q.from) qs.set('from', q.from);
  if (q.to) qs.set('to', q.to);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const reportsApi = {
  adminSales: (q: ReportRangeQuery = {}) =>
    api<AdminSalesReport>(`/admin/reports/sales${rangeQuery(q)}`),
  adminAttention: () => api<AdminAttention>('/admin/reports/attention'),
  vendorSales: (q: ReportRangeQuery = {}) =>
    api<VendorSalesReport>(`/vendor/reports/sales${rangeQuery(q)}`),
  vendorAttention: () => api<VendorAttention>('/vendor/reports/attention'),
};
