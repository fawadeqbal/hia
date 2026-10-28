import type {
  MockCheckoutDto,
  MockPaymentCompleteInput,
  MockPaymentCompleteResult,
  PaymentSessionDto,
  PaymentStatusDto,
  StartPaymentInput,
} from '@ecommerce/types';
import { api } from '../http';

export const paymentsApi = {
  /** After the gateway redirect: where does this attempt stand? */
  status: (paymentId: string) => api<PaymentStatusDto>(`/payments/${paymentId}/status`),
  /** New attempt for the same order (after a failure or cancel at the gateway). */
  retry: (paymentId: string) =>
    api<PaymentSessionDto>(`/payments/${paymentId}/retry`, { method: 'POST', body: {} }),
  /** "Pay now" from the order page. Guests send the checkout email. */
  payOrder: (orderNumber: string, body: StartPaymentInput = {}) =>
    api<PaymentSessionDto>(`/payments/orders/${encodeURIComponent(orderNumber)}/pay`, {
      method: 'POST',
      body,
    }),

  // ---- mock gateway (development only) ----
  mockCheckout: (paymentId: string) => api<MockCheckoutDto>(`/payments/mock/${paymentId}`),
  mockComplete: (paymentId: string, body: MockPaymentCompleteInput) =>
    api<MockPaymentCompleteResult>(`/payments/mock/${paymentId}/complete`, {
      method: 'POST',
      body,
    }),
};
