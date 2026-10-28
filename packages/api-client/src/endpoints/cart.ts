import type { AddToCartInput, CartDto, SavedItemDto, UpdateCartItemInput } from '@ecommerce/types';
import { api } from '../http';

/** Works for guests (cart_session cookie) and signed-in users (merged automatically at sign-in). */
export const cartApi = {
  get: () => api<CartDto>('/cart'),
  add: (body: AddToCartInput) => api<CartDto>('/cart/items', { method: 'POST', body }),
  update: (itemId: string, body: UpdateCartItemInput) =>
    api<CartDto>(`/cart/items/${itemId}`, { method: 'PATCH', body }),
  remove: (itemId: string) => api<CartDto>(`/cart/items/${itemId}`, { method: 'DELETE' }),

  // ---- signed-in only ----
  saveForLater: (itemId: string) =>
    api<CartDto>(`/cart/items/${itemId}/save-for-later`, { method: 'POST', body: {} }),
  saved: () => api<SavedItemDto[]>('/cart/saved'),
  moveToCart: (savedId: string) =>
    api<CartDto>(`/cart/saved/${savedId}/move-to-cart`, { method: 'POST', body: {} }),
  removeSaved: (savedId: string) => api<void>(`/cart/saved/${savedId}`, { method: 'DELETE' }),
};
