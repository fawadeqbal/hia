import type {
  AddressDto,
  AddressInput,
  AdminOrderListItem,
  CancelOrderInput,
  CheckoutQuoteDto,
  CheckoutQuoteInput,
  OrderDto,
  OrderListQuery,
  OrderSummaryDto,
  Paginated,
  PlaceOrderInput,
  PlaceOrderResultDto,
  TrackOrderInput,
  VendorOrderDetailDto,
  VendorOrderListItem,
  VendorOrderStatusInput,
} from '@ecommerce/types';
import { api } from '../http';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const addressesApi = {
  list: () => api<AddressDto[]>('/users/me/addresses'),
  create: (body: AddressInput) => api<AddressDto>('/users/me/addresses', { method: 'POST', body }),
  update: (id: string, body: Partial<AddressInput>) =>
    api<AddressDto>(`/users/me/addresses/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api<void>(`/users/me/addresses/${id}`, { method: 'DELETE' }),
};

export const checkoutApi = {
  /** Totals for the current cart and the chosen payment method (COD adds its fee). */
  quote: (body: CheckoutQuoteInput = {}) =>
    api<CheckoutQuoteDto>('/checkout/quote', { method: 'POST', body }),
  /** Online methods return `payment.redirectUrl`: send the customer there to pay. */
  place: (body: PlaceOrderInput) =>
    api<PlaceOrderResultDto>('/checkout/place', { method: 'POST', body }),
};

export const ordersApi = {
  // ---- customer ----
  mine: (params: OrderListQuery = {}) =>
    api<Paginated<OrderSummaryDto>>(`/orders${toQuery(params)}`),
  get: (orderNumber: string) => api<OrderDto>(`/orders/${encodeURIComponent(orderNumber)}`),
  cancel: (orderNumber: string, body: CancelOrderInput) =>
    api<OrderDto>(`/orders/${encodeURIComponent(orderNumber)}/cancel`, { method: 'POST', body }),
  /** Guests: order number + email. */
  track: (body: TrackOrderInput) => api<OrderDto>('/orders/track', { method: 'POST', body }),

  // ---- vendor (own sub-orders) ----
  vendorList: (params: OrderListQuery = {}) =>
    api<Paginated<VendorOrderListItem>>(`/vendor/orders${toQuery(params)}`),
  vendorGet: (id: string) => api<VendorOrderDetailDto>(`/vendor/orders/${id}`),
  vendorUpdateStatus: (id: string, body: VendorOrderStatusInput) =>
    api<VendorOrderDetailDto>(`/vendor/orders/${id}/status`, { method: 'POST', body }),

  // ---- admin ----
  adminList: (params: OrderListQuery = {}) =>
    api<Paginated<AdminOrderListItem>>(`/admin/orders${toQuery(params)}`),
  adminGet: (id: string) => api<OrderDto>(`/admin/orders/${id}`),
  adminCancel: (id: string, body: CancelOrderInput) =>
    api<OrderDto>(`/admin/orders/${id}/cancel`, { method: 'POST', body }),
};
