import type {
  Paginated,
  ProductDto,
  ProductFeatureInput,
  ProductInput,
  ProductListItem,
  ProductListQuery,
  ProductVariantsInput,
} from '@ecommerce/types';
import { api } from '../http';

function toQuery(params: ProductListQuery): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const VENDOR = '/vendor/products';
const ADMIN = '/admin/products';

export const productsApi = {
  // ---- the shop's products ----
  vendorList: (params: ProductListQuery = {}) =>
    api<Paginated<ProductListItem>>(`${VENDOR}${toQuery(params)}`),
  vendorGet: (id: string) => api<ProductDto>(`${VENDOR}/${id}`),
  create: (body: ProductInput) => api<ProductDto>(VENDOR, { method: 'POST', body }),
  update: (id: string, body: Partial<ProductInput>) =>
    api<ProductDto>(`${VENDOR}/${id}`, { method: 'PATCH', body }),
  submit: (id: string) => api<ProductDto>(`${VENDOR}/${id}/submit`, { method: 'POST', body: {} }),
  archive: (id: string) => api<ProductDto>(`${VENDOR}/${id}/archive`, { method: 'POST', body: {} }),
  restore: (id: string) => api<ProductDto>(`${VENDOR}/${id}/restore`, { method: 'POST', body: {} }),
  remove: (id: string) => api<void>(`${VENDOR}/${id}`, { method: 'DELETE' }),
  /** Replaces the full variant list (generate combinations in the UI first). */
  saveVariants: (id: string, body: ProductVariantsInput) =>
    api<ProductDto>(`${VENDOR}/${id}/variants`, { method: 'PUT', body }),

  // ---- admin ----
  setFeatured: (id: string, body: ProductFeatureInput) =>
    api<ProductDto>(`${ADMIN}/${id}/featured`, { method: 'PATCH', body }),
};
