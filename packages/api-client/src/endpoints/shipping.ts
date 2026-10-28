import type {
  CourierDto,
  CourierInput,
  ShippingZoneDto,
  ShippingZoneInput,
} from '@ecommerce/types';
import { api } from '../http';

export const shippingApi = {
  // ---- admin: zones + rates ----
  zones: () => api<ShippingZoneDto[]>('/admin/shipping/zones'),
  zone: (id: string) => api<ShippingZoneDto>(`/admin/shipping/zones/${id}`),
  createZone: (body: ShippingZoneInput) =>
    api<ShippingZoneDto>('/admin/shipping/zones', { method: 'POST', body }),
  updateZone: (id: string, body: ShippingZoneInput) =>
    api<ShippingZoneDto>(`/admin/shipping/zones/${id}`, { method: 'PATCH', body }),
  removeZone: (id: string) => api<void>(`/admin/shipping/zones/${id}`, { method: 'DELETE' }),

  // ---- admin: couriers ----
  couriers: () => api<CourierDto[]>('/admin/shipping/couriers'),
  createCourier: (body: CourierInput) =>
    api<CourierDto>('/admin/shipping/couriers', { method: 'POST', body }),
  updateCourier: (id: string, body: CourierInput) =>
    api<CourierDto>(`/admin/shipping/couriers/${id}`, { method: 'PATCH', body }),
  removeCourier: (id: string) => api<void>(`/admin/shipping/couriers/${id}`, { method: 'DELETE' }),

  // ---- seller: active couriers for the "mark as shipped" dialog ----
  vendorCouriers: () => api<CourierDto[]>('/vendor/shipping/couriers'),
};
