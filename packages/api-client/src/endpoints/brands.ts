import type { BrandDto, BrandInput, BrandListItem } from '@ecommerce/types';
import { api } from '../http';

const ADMIN = '/admin/catalog/brands';

export const brandsApi = {
  /** Public list of active brands (storefront filters, brand pages). */
  list: () => api<BrandDto[]>('/catalog/brands'),

  // ---- admin ----
  adminList: () => api<BrandListItem[]>(ADMIN),
  get: (id: string) => api<BrandDto>(`${ADMIN}/${id}`),
  create: (body: BrandInput) => api<BrandDto>(ADMIN, { method: 'POST', body }),
  update: (id: string, body: Partial<BrandInput>) =>
    api<BrandDto>(`${ADMIN}/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api<void>(`${ADMIN}/${id}`, { method: 'DELETE' }),
};
