import type { AttributeDto, AttributeInput } from '@ecommerce/types';
import { api } from '../http';

const ADMIN = '/admin/catalog/attributes';

export const attributesApi = {
  /** Public: filterable attributes with their values (storefront filters). */
  filters: () => api<AttributeDto[]>('/catalog/attributes'),
  /** Public: every attribute with values (variant builder in the seller center). */
  all: () => api<AttributeDto[]>('/catalog/attributes/all'),

  // ---- admin ----
  adminList: () => api<AttributeDto[]>(ADMIN),
  get: (id: string) => api<AttributeDto>(`${ADMIN}/${id}`),
  create: (body: AttributeInput) => api<AttributeDto>(ADMIN, { method: 'POST', body }),
  update: (id: string, body: Partial<AttributeInput>) =>
    api<AttributeDto>(`${ADMIN}/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api<void>(`${ADMIN}/${id}`, { method: 'DELETE' }),
};
