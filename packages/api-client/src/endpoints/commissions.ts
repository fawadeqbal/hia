import type {
  CommissionPreviewDto,
  CommissionPreviewQuery,
  CommissionRuleDto,
  CommissionRuleInput,
} from '@ecommerce/types';
import { api } from '../http';

const BASE = '/admin/vendors/commissions';

export const commissionsApi = {
  list: () => api<CommissionRuleDto[]>(BASE),
  create: (body: CommissionRuleInput) => api<CommissionRuleDto>(BASE, { method: 'POST', body }),
  update: (id: string, body: Partial<CommissionRuleInput>) =>
    api<CommissionRuleDto>(`${BASE}/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api<void>(`${BASE}/${id}`, { method: 'DELETE' }),
  preview: (q: CommissionPreviewQuery) =>
    api<CommissionPreviewDto>(
      `${BASE}/preview?vendorId=${encodeURIComponent(q.vendorId)}${
        q.categoryId ? `&categoryId=${encodeURIComponent(q.categoryId)}` : ''
      }`,
    ),
};
