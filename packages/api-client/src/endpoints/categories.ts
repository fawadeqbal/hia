import type {
  CategoryDto,
  CategoryInput,
  CategoryListItem,
  CategoryTreeNode,
} from '@ecommerce/types';
import { api } from '../http';

const ADMIN = '/admin/catalog/categories';

export const categoriesApi = {
  /** Public nested tree for storefront navigation. */
  tree: () => api<CategoryTreeNode[]>('/catalog/categories'),

  // ---- admin ----
  adminList: () => api<CategoryListItem[]>(ADMIN),
  get: (id: string) => api<CategoryDto>(`${ADMIN}/${id}`),
  create: (body: CategoryInput) => api<CategoryDto>(ADMIN, { method: 'POST', body }),
  update: (id: string, body: Partial<CategoryInput>) =>
    api<CategoryDto>(`${ADMIN}/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api<void>(`${ADMIN}/${id}`, { method: 'DELETE' }),
};
