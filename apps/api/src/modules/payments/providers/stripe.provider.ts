import Stripe from 'stripe';
import type { PaymentMethod } from '@ecommerce/types';
import type {
  CreateSessionInput,
  CreateSessionResult,
  ParsedWebhook,
  PaymentProvider,
  RefundInput,
  RefundResult,
  WebhookHeaders,
  WebhookOutcome,
} from './payment-provider';

/** Currencies Stripe expects in whole units (no cents). */
const ZERO_DECIMAL = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);
export const toMinor = (amount: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
export const fromMinor = (minor: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toUpperCase()) ? minor : minor / 100;

/** Stripe Checkout (hosted page). The session id is our provider reference. */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly methods: PaymentMethod[] = ['CARD', 'WALLET'];
  private readonly stripe: Stripe | null;

  constructor(private readonly options: { secretKey: string; webhookSecret: string }) {
    this.stripe = options.secretKey ? new Stripe(options.secretKey) : null;
  }

  /** Usable only with both keys. */
  get enabled(): boolean {
    return Boolean(this.options.secretKey && this.options.webhookSecret);
  }

  private client(): Stripe {
    if (!this.stripe) throw new Error('Stripe secret key is not set');
    return this.stripe;
  }

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    // Stripe needs expires_at 30 min – 24 h ahead; our stock hold may be shorter (the order expiry still applies).
    const min = Math.ceil(Date.now() / 1000) + 31 * 60;
    const session = await this.client().checkout.sessions.create({
      mode: 'payment',
      client_reference_id: input.paymentId,
      customer_email: input.customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: toMinor(input.amount, input.currency),
            product_data: { name: `Order ${input.orderNumber}` },
          },
        },
      ],
      metadata: { paymentId: input.paymentId, orderNumber: input.orderNumber },
      payment_intent_data: {
        metadata: { paymentId: input.paymentId, orderNumber: input.orderNumber },
      },
      success_url: input.returnUrl,
      cancel_url: input.returnUrl,
      expires_at: Math.max(min, Math.floor(input.expiresAt.getTime() / 1000)),
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { providerRef: session.id, redirectUrl: session.url };
  }

  parseWebhook(headers: WebhookHeaders, rawBody: Buffer): ParsedWebhook {
    const signature = headers['stripe-signature'];
    if (typeof signature !== 'string') throw new Error('Missing Stripe signature');
    // Throws when the signature does not match the webhook secret.
    const event = Stripe.webhooks.constructEvent(rawBody, signature, this.options.webhookSecret);
    let outcome: WebhookOutcome | null = null;
    let providerRef = '';
    let amount: number | null = null;
    if (event.type.startsWith('checkout.session.')) {
      const s = event.data.object as Stripe.Checkout.Session;
      providerRef = s.id;
      amount = s.amount_total === null ? null : fromMinor(s.amount_total, s.currency ?? 'usd');
      if (event.type === 'checkout.session.completed')
        outcome = s.payment_status === 'paid' ? 'PAID' : null;
      else if (event.type === 'checkout.session.async_payment_succeeded') outcome = 'PAID';
      else if (event.type === 'checkout.session.async_payment_failed') outcome = 'FAILED';
      else if (event.type === 'checkout.session.expired') outcome = 'CANCELLED';
    }
    return {
      eventId: event.id,
      type: event.type,
      providerRef,
      outcome,
      amount,
      payload: { id: event.id, type: event.type, livemode: event.livemode, object: providerRef },
    };
  }

  /** Reads the Checkout Session directly — confirms payments even when no webhook arrives. */
  async fetchOutcome(providerRef: string): Promise<ParsedWebhook | null> {
    if (!this.stripe || !providerRef.startsWith('cs_')) return null;
    const s = await this.stripe.checkout.sessions.retrieve(providerRef);
    let outcome: WebhookOutcome | null = null;
    if (s.status === 'complete' && s.payment_status === 'paid') outcome = 'PAID';
    else if (s.status === 'expired') outcome = 'CANCELLED';
    if (!outcome) return null;
    const eventId = `sync_${s.id}`;
    return {
      eventId,
      type: 'checkout.session.sync',
      providerRef: s.id,
      outcome,
      amount: s.amount_total === null ? null : fromMinor(s.amount_total, s.currency ?? 'usd'),
      payload: { id: eventId, type: 'checkout.session.sync', livemode: s.livemode, object: s.id },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const session = await this.client().checkout.sessions.retrieve(input.providerRef);
    const intent =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!intent) return { providerRef: '', succeeded: false };
    const refund = await this.client().refunds.create({
      payment_intent: intent,
      amount: toMinor(input.amount, input.currency),
      reason: 'requested_by_customer',
      metadata: { reason: input.reason.slice(0, 450) },
    });
    return {
      providerRef: refund.id,
      succeeded: refund.status === 'succeeded' || refund.status === 'pending',
    };
  }
}
