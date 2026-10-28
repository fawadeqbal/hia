import type {
  GeneratePayoutsResultDto,
  MarkPayoutInput,
  PayoutDto,
  PayoutStatus,
  VendorEarningsDto,
} from '@ecommerce/types';
import { api } from '../http';

export const payoutsApi = {
  // ---- seller ----
  earnings: () => api<VendorEarningsDto>('/vendor/payouts/earnings'),
  vendorList: () => api<PayoutDto[]>('/vendor/payouts'),
  vendorGet: (id: string) => api<PayoutDto>(`/vendor/payouts/${id}`),

  // ---- admin ----
  adminList: (status?: PayoutStatus) =>
    api<PayoutDto[]>(`/admin/payouts${status ? `?status=${status}` : ''}`),
  adminGet: (id: string) => api<PayoutDto>(`/admin/payouts/${id}`),
  generate: () =>
    api<GeneratePayoutsResultDto>('/admin/payouts/generate', { method: 'POST', body: {} }),
  mark: (id: string, body: MarkPayoutInput) =>
    api<PayoutDto>(`/admin/payouts/${id}/status`, { method: 'POST', body }),
  cancel: (id: string) => api<void>(`/admin/payouts/${id}`, { method: 'DELETE' }),
};
