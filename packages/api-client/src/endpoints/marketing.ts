import type {
  CampaignAudience,
  CampaignDto,
  CampaignInput,
  CustomerSegment,
  Paginated,
  SignedEmailInput,
  SubscriberDto,
  SubscriberQuery,
} from '@ecommerce/types';
import { api } from '../http';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const marketingApi = {
  // ---- storefront ----
  subscribe: (email: string) =>
    api<{ message: string }>('/newsletter/subscribe', { method: 'POST', body: { email } }),
  confirm: (body: SignedEmailInput) =>
    api<{ message: string }>('/newsletter/confirm', { method: 'POST', body }),
  unsubscribe: (body: SignedEmailInput) =>
    api<{ message: string }>('/newsletter/unsubscribe', { method: 'POST', body }),

  // ---- admin: subscribers ----
  subscribers: (params: SubscriberQuery = {}) =>
    api<Paginated<SubscriberDto>>(`/admin/marketing/subscribers${toQuery(params)}`),
  exportSubscribers: () => api<SubscriberDto[]>('/admin/marketing/subscribers/export'),
  removeSubscriber: (id: string) =>
    api<void>(`/admin/marketing/subscribers/${id}`, { method: 'DELETE' }),

  // ---- admin: campaigns ----
  campaigns: () => api<CampaignDto[]>('/admin/marketing/campaigns'),
  campaign: (id: string) => api<CampaignDto>(`/admin/marketing/campaigns/${id}`),
  createCampaign: (body: CampaignInput) =>
    api<CampaignDto>('/admin/marketing/campaigns', { method: 'POST', body }),
  updateCampaign: (id: string, body: CampaignInput) =>
    api<CampaignDto>(`/admin/marketing/campaigns/${id}`, { method: 'PATCH', body }),
  removeCampaign: (id: string) =>
    api<void>(`/admin/marketing/campaigns/${id}`, { method: 'DELETE' }),
  audienceCount: (audience: CampaignAudience, segment: CustomerSegment | null) =>
    api<{ count: number }>(`/admin/marketing/audience${toQuery({ audience, segment })}`),
  sendTest: (id: string, email: string) =>
    api<{ message: string }>(`/admin/marketing/campaigns/${id}/test`, {
      method: 'POST',
      body: { email },
    }),
  schedule: (id: string, scheduledAt: string | null) =>
    api<CampaignDto>(`/admin/marketing/campaigns/${id}/schedule`, {
      method: 'POST',
      body: { scheduledAt },
    }),
  cancel: (id: string) =>
    api<CampaignDto>(`/admin/marketing/campaigns/${id}/cancel`, { method: 'POST', body: {} }),
};
