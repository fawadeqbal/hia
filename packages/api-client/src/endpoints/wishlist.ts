import type { CartDto, StockAlertInput, WishlistAddInput, WishlistDto } from '@ecommerce/types';
import { api } from '../http';

export const wishlistApi = {
  get: () => api<WishlistDto>('/wishlist'),
  add: (body: WishlistAddInput) => api<WishlistDto>('/wishlist/items', { method: 'POST', body }),
  remove: (itemId: string) => api<WishlistDto>(`/wishlist/items/${itemId}`, { method: 'DELETE' }),
  removeProduct: (productId: string) =>
    api<WishlistDto>(`/wishlist/products/${productId}`, { method: 'DELETE' }),
  /** Adds the saved item to the cart (default variant when none was chosen) and removes it from the list. */
  moveToCart: (itemId: string) =>
    api<{ wishlist: WishlistDto; cart: CartDto }>(`/wishlist/items/${itemId}/move-to-cart`, {
      method: 'POST',
      body: {},
    }),
  /** Back-in-stock email for a sold-out variant. */
  notifyMe: (body: StockAlertInput) =>
    api<{ subscribed: true }>('/stock-alerts', { method: 'POST', body }),
};
