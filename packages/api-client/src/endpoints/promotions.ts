import type { CouponDto, CouponInput, PromotionDto, PromotionInput } from '@ecommerce/types';
import { api } from '../http';

function couponCrud(prefix: '/admin/promotions/coupons' | '/vendor/coupons') {
  return {
    list: () => api<CouponDto[]>(prefix),
    get: (id: string) => api<CouponDto>(`${prefix}/${id}`),
    create: (body: CouponInput) => api<CouponDto>(prefix, { method: 'POST', body }),
    update: (id: string, body: CouponInput) =>
      api<CouponDto>(`${prefix}/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => api<void>(`${prefix}/${id}`, { method: 'DELETE' }),
  };
}

export const promotionsApi = {
  adminCoupons: couponCrud('/admin/promotions/coupons'),
  vendorCoupons: couponCrud('/vendor/coupons'),
  discounts: () => api<PromotionDto[]>('/admin/promotions/discounts'),
  discount: (id: string) => api<PromotionDto>(`/admin/promotions/discounts/${id}`),
  createDiscount: (body: PromotionInput) =>
    api<PromotionDto>('/admin/promotions/discounts', { method: 'POST', body }),
  updateDiscount: (id: string, body: PromotionInput) =>
    api<PromotionDto>(`/admin/promotions/discounts/${id}`, { method: 'PATCH', body }),
  removeDiscount: (id: string) =>
    api<void>(`/admin/promotions/discounts/${id}`, { method: 'DELETE' }),
};
