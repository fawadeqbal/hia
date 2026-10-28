import type {
  BlockCustomerInput,
  CustomerDetail,
  CustomerListQuery,
  CustomerListResult,
} from '@ecommerce/types';
import { api } from '../http';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const customersApi = {
  list: (q: CustomerListQuery = {}) => api<CustomerListResult>(`/admin/customers${toQuery(q)}`),
  get: (id: string) => api<CustomerDetail>(`/admin/customers/${id}`),
  block: (id: string, body: BlockCustomerInput) =>
    api<CustomerDetail>(`/admin/customers/${id}/block`, { method: 'POST', body }),
  unblock: (id: string) =>
    api<CustomerDetail>(`/admin/customers/${id}/unblock`, { method: 'POST', body: {} }),
};
