import type { CustomerOrderNoteDto, OrderNoteDto, OrderNoteInput } from '@ecommerce/types';
import { API_URL, api } from '../http';

const enc = encodeURIComponent;

/**
 * PDFs are plain links (opened in a new tab; the session cookie authenticates them).
 * Notes go through the JSON API.
 */
export const documentsApi = {
  // ---- PDF links ----
  customerInvoiceUrl: (orderNumber: string) => `${API_URL}/orders/${enc(orderNumber)}/invoice`,
  adminInvoiceUrl: (orderId: string) => `${API_URL}/admin/orders/${orderId}/invoice`,
  adminPackingSlipUrl: (orderId: string) => `${API_URL}/admin/orders/${orderId}/packing-slip`,

  // ---- notes ----
  customerNotes: (orderNumber: string) =>
    api<CustomerOrderNoteDto[]>(`/orders/${enc(orderNumber)}/notes`),
  adminNotes: (orderId: string) => api<OrderNoteDto[]>(`/admin/orders/${orderId}/notes`),
  addAdminNote: (orderId: string, body: OrderNoteInput) =>
    api<OrderNoteDto>(`/admin/orders/${orderId}/notes`, { method: 'POST', body }),
  removeAdminNote: (orderId: string, noteId: string) =>
    api<void>(`/admin/orders/${orderId}/notes/${noteId}`, { method: 'DELETE' }),
};
