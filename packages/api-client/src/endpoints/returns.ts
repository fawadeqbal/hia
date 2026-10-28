import type {
  CreateReturnInput,
  Paginated,
  ReceiveReturnInput,
  RefundReturnInput,
  ReturnDecisionInput,
  ReturnListItem,
  ReturnListQuery,
  ReturnRequestDto,
} from '@ecommerce/types';
import { api } from '../http';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Seller and admin share the same actions under their own prefix. */
function staffApi(prefix: '/vendor/returns' | '/admin/returns') {
  return {
    list: (params: ReturnListQuery = {}) =>
      api<Paginated<ReturnListItem>>(`${prefix}${toQuery(params)}`),
    get: (id: string) => api<ReturnRequestDto>(`${prefix}/${id}`),
    approve: (id: string, body: ReturnDecisionInput = {}) =>
      api<ReturnRequestDto>(`${prefix}/${id}/approve`, { method: 'POST', body }),
    reject: (id: string, body: ReturnDecisionInput) =>
      api<ReturnRequestDto>(`${prefix}/${id}/reject`, { method: 'POST', body }),
    receive: (id: string, body: ReceiveReturnInput) =>
      api<ReturnRequestDto>(`${prefix}/${id}/receive`, { method: 'POST', body }),
    refund: (id: string, body: RefundReturnInput) =>
      api<ReturnRequestDto>(`${prefix}/${id}/refund`, { method: 'POST', body }),
  };
}

export const returnsApi = {
  // ---- customer ----
  mine: (params: ReturnListQuery = {}) =>
    api<Paginated<ReturnListItem>>(`/returns${toQuery(params)}`),
  get: (rmaNumber: string) => api<ReturnRequestDto>(`/returns/${encodeURIComponent(rmaNumber)}`),
  create: (body: CreateReturnInput) => api<ReturnRequestDto>('/returns', { method: 'POST', body }),
  cancel: (rmaNumber: string) =>
    api<ReturnRequestDto>(`/returns/${encodeURIComponent(rmaNumber)}/cancel`, {
      method: 'POST',
      body: {},
    }),

  vendor: staffApi('/vendor/returns'),
  admin: staffApi('/admin/returns'),
};
