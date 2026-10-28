import type { OrderStatus, PaymentMethod, PaymentStatus } from '../enums';
import type { ShippingDestination } from '../shipping/shipping';

/**
 * Online payments go through a pluggable gateway (PaymentProvider in apps/api/src/modules/payments).
 * Locally the "mock" provider plays the gateway: a hosted test page where you choose success / failure.
 */

/** Methods paid through a gateway before the order is confirmed (COD is paid at the door). */
export const ONLINE_PAYMENT_METHODS: PaymentMethod[] = ['CARD', 'WALLET', 'BANK_TRANSFER'];

export function isOnlinePayment(method: PaymentMethod): boolean {
  return ONLINE_PAYMENT_METHODS.includes(method);
}

/** Checkout copy for each method the storefront can offer. */
export const PAYMENT_METHOD_DESCRIPTIONS: Partial<Record<PaymentMethod, string>> = {
  COD: 'Pay in cash when your order arrives.',
  CARD: 'Visa, Mastercard or UnionPay debit / credit card.',
  WALLET: 'Mobile wallet such as JazzCash or Easypaisa.',
  BANK_TRANSFER: 'Pay directly from your bank account.',
  GIFT_CARD: 'Fully covered by your gift card / points — nothing else to pay.',
};

/** One row of the payment picker at checkout. */
export interface PaymentOptionDto {
  method: PaymentMethod;
  label: string;
  description: string;
  /** Extra fee for this method (COD fee). */
  fee: number;
  available: boolean;
  /** Why it is unavailable (e.g. COD limit). */
  reason: string | null;
}

export interface CheckoutQuoteInput {
  /** Totals are calculated for this method (COD adds its fee). Defaults to the first available. */
  paymentMethod?: PaymentMethod;
  /** Saved address (signed-in) or typed destination; picks the shipping zone. */
  addressId?: string;
  destination?: ShippingDestination;
  /** Chosen delivery option per seller: { vendorId: rateId }. */
  shippingRateIds?: Record<string, string>;
  couponCode?: string | null;
  /** Use loyalty points (signed-in). */
  redeemPoints?: boolean;
  giftCardCode?: string | null;
  /** Guest email, for per-customer coupon limits. */
  email?: string;
}

/** Where to send the customer to pay (the gateway's hosted page). */
export interface PaymentSessionDto {
  paymentId: string;
  orderNumber: string;
  provider: string;
  redirectUrl: string;
  /** Unpaid orders are cancelled and their stock released after this moment. */
  expiresAt: string;
}

/** A payment attempt on an order (admin view, reconciliation). */
export interface PaymentAttemptDto {
  id: string;
  method: PaymentMethod;
  provider: string;
  status: PaymentStatus;
  amount: number;
  refundedAmount: number;
  currency: string;
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public status of one attempt — what the "payment return" page shows after the gateway redirect.
 * Knowing the attempt id (an unguessable cuid from the redirect) is enough to read it.
 */
export interface PaymentStatusDto {
  paymentId: string;
  orderNumber: string;
  email: string;
  orderStatus: OrderStatus;
  orderPaymentStatus: PaymentStatus;
  attemptStatus: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  currency: string;
  /** The order still waits for payment and the customer may try again. */
  canRetry: boolean;
  expiresAt: string | null;
}

/** Start (or restart) payment for an unpaid order. Guests prove ownership with the checkout email. */
export interface StartPaymentInput {
  email?: string;
}

// ---------------------------------------------------------------- mock gateway (development)

export const MOCK_PAYMENT_OUTCOMES = ['success', 'fail', 'cancel'] as const;
export type MockPaymentOutcome = (typeof MOCK_PAYMENT_OUTCOMES)[number];

/** What the mock gateway's hosted page shows. */
export interface MockCheckoutDto {
  paymentId: string;
  orderNumber: string;
  merchantName: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  expiresAt: string | null;
  returnUrl: string;
}

export interface MockPaymentCompleteInput {
  outcome: MockPaymentOutcome;
}

export interface MockPaymentCompleteResult {
  /** Where the gateway sends the customer back to (the storefront return page). */
  returnUrl: string;
}
