import type { CouponDto, CouponInput, ImportResult, ImportRowsInput } from '@ecommerce/types';
import { api } from '../http';

const P = '/admin/promotions/coupons';

export const promotionsApi = {
  adminCoupons: {
    list: () => api<CouponDto[]>(P),
    get: (id: string) => api<CouponDto>(`${P}/${id}`),
    create: (body: CouponInput) => api<CouponDto>(P, { method: 'POST', body }),
    update: (id: string, body: CouponInput) =>
      api<CouponDto>(`${P}/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => api<void>(`${P}/${id}`, { method: 'DELETE' }),
    /** Excel upload (dryRun = preview). */
    importRows: (body: ImportRowsInput) =>
      api<ImportResult>(`${P}/import`, { method: 'POST', body }),
  },
};
