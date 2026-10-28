import type {
  OrderRewardsDto,
  Paginated,
  RewardActivityItem,
  RewardActivityQuery,
  RewardActivitySummary,
} from '@ecommerce/types';
import { api } from '../http';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const rewardsApi = {
  activity: (q: RewardActivityQuery = {}) =>
    api<Paginated<RewardActivityItem>>(`/admin/loyalty/activity${toQuery(q)}`),
  summary: (range: { from?: string; to?: string } = {}) =>
    api<RewardActivitySummary>(`/admin/loyalty/activity/summary${toQuery(range)}`),
  order: (orderId: string) => api<OrderRewardsDto>(`/admin/orders/${orderId}/rewards`),
  couponUsage: (couponId: string, q: { page?: number; limit?: number } = {}) =>
    api<Paginated<RewardActivityItem>>(`/admin/promotions/coupons/${couponId}/usage${toQuery(q)}`),
  customer: (userId: string, q: { page?: number; limit?: number } = {}) =>
    api<Paginated<RewardActivityItem>>(`/admin/customers/${userId}/rewards${toQuery(q)}`),
};
