import type {
  Paginated,
  VendorAdminDto,
  VendorAdminUpdateInput,
  VendorApplicationInput,
  VendorApproveInput,
  VendorListItem,
  VendorListQuery,
  VendorPayoutInput,
  VendorProfileInput,
  VendorPublicDto,
  VendorReasonInput,
  VendorSelfDto,
} from '@ecommerce/types';
import { api } from '../http';

const ADMIN = '/admin/vendors';

function toQuery(params: VendorListQuery): string {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const vendorsApi = {
  // ---- public ----
  /** Creates the seller account + store (status PENDING) and signs the user in. */
  apply: (body: VendorApplicationInput) =>
    api<VendorSelfDto>('/vendors/apply', { method: 'POST', body }),
  publicGet: (slug: string) => api<VendorPublicDto>(`/vendors/${slug}`),

  // ---- signed-in vendor ----
  me: () => api<VendorSelfDto>('/vendor/me'),
  updateProfile: (body: VendorProfileInput) =>
    api<VendorSelfDto>('/vendor/me', { method: 'PATCH', body }),
  updatePayout: (body: VendorPayoutInput) =>
    api<VendorSelfDto>('/vendor/me/payout', { method: 'PUT', body }),

  // ---- admin ----
  adminList: (params: VendorListQuery = {}) =>
    api<Paginated<VendorListItem>>(`${ADMIN}${toQuery(params)}`),
  adminGet: (id: string) => api<VendorAdminDto>(`${ADMIN}/${id}`),
  adminUpdate: (id: string, body: VendorAdminUpdateInput) =>
    api<VendorAdminDto>(`${ADMIN}/${id}`, { method: 'PATCH', body }),
  approve: (id: string, body: VendorApproveInput = {}) =>
    api<VendorAdminDto>(`${ADMIN}/${id}/approve`, { method: 'POST', body }),
  reject: (id: string, body: VendorReasonInput) =>
    api<VendorAdminDto>(`${ADMIN}/${id}/reject`, { method: 'POST', body }),
  suspend: (id: string, body: VendorReasonInput) =>
    api<VendorAdminDto>(`${ADMIN}/${id}/suspend`, { method: 'POST', body }),
  reactivate: (id: string) =>
    api<VendorAdminDto>(`${ADMIN}/${id}/reactivate`, { method: 'POST', body: {} }),
};
