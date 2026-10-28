import type { PaymentMethod } from '@ecommerce/types';

/**
 * The only thing a real gateway (Safepay, PayFast, JazzCash, …) has to implement.
 * Everything else — order states, stock, emails, refunds bookkeeping — lives in PaymentsService.
 */
export interface PaymentProvider {
  /** Stored in Payment.provider and used in the webhook URL: POST /payments/webhooks/<name>. */
  readonly name: string;
  /** Methods this gateway can take (intersected with the `payments.onlineMethods` setting). */
  readonly methods: PaymentMethod[];
  /** False hides online payment at checkout (e.g. mock gateway in production). */
  readonly enabled: boolean;

  /** Creates a hosted payment page / intent and returns where to send the customer. */
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  /** Verifies the webhook signature (throw UnauthorizedException) and normalises the event. */
  parseWebhook(headers: WebhookHeaders, rawBody: Buffer): ParsedWebhook;
  /** Refunds (part of) a captured payment. */
  refund(input: RefundInput): Promise<RefundResult>;
  /**
   * Optional: ask the gateway for the attempt's final outcome (null = still open).
   * Used when the webhook is late or can't reach us (e.g. a local API Stripe can't call).
   */
  fetchOutcome?(providerRef: string): Promise<ParsedWebhook | null>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export type WebhookHeaders = Record<string, string | string[] | undefined>;

export interface CreateSessionInput {
  paymentId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  customerEmail: string;
  /** Storefront page the gateway redirects back to. */
  returnUrl: string;
  expiresAt: Date;
}

export interface CreateSessionResult {
  /** The gateway's id for this payment; webhooks refer to it. */
  providerRef: string;
  redirectUrl: string;
}

export type WebhookOutcome = 'PAID' | 'FAILED' | 'CANCELLED';

export interface ParsedWebhook {
  /** Unique per event: duplicates are ignored (WebhookEvent provider + eventId). */
  eventId: string;
  type: string;
  providerRef: string;
  /** null = an event type we do not act on. */
  outcome: WebhookOutcome | null;
  /** Amount the gateway captured (checked against the payment), when it reports one. */
  amount: number | null;
  payload: Record<string, unknown>;
}

export interface RefundInput {
  providerRef: string;
  amount: number;
  currency: string;
  reason: string;
}

export interface RefundResult {
  providerRef: string;
  succeeded: boolean;
}
