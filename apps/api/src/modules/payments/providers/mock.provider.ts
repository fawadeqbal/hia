import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { MockPaymentOutcome, PaymentMethod } from '@ecommerce/types';
import { signPayload, verifySignature } from '../payment-rules';
import type {
  CreateSessionInput,
  CreateSessionResult,
  ParsedWebhook,
  PaymentProvider,
  RefundResult,
  WebhookHeaders,
  WebhookOutcome,
} from './payment-provider';

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

const EVENT_TYPES: Record<MockPaymentOutcome, string> = {
  success: 'payment.succeeded',
  fail: 'payment.failed',
  cancel: 'payment.cancelled',
};
const OUTCOMES: Record<string, WebhookOutcome> = {
  'payment.succeeded': 'PAID',
  'payment.failed': 'FAILED',
  'payment.cancelled': 'CANCELLED',
};

interface MockEvent {
  id: string;
  type: string;
  data: { reference: string; amount: number };
}

/**
 * Development gateway. Its "hosted page" is the storefront route /pay/mock/<paymentId>; the buttons there
 * call simulate(), which produces a signed webhook that goes through the same code path as a real gateway.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly methods: PaymentMethod[] = ['CARD', 'WALLET', 'BANK_TRANSFER'];

  constructor(private readonly options: { secret: string; siteUrl: string; enabled: boolean }) {}

  get enabled(): boolean {
    return this.options.enabled;
  }

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    return {
      providerRef: `mock_${input.paymentId}`,
      redirectUrl: `${this.options.siteUrl}/pay/mock/${input.paymentId}`,
    };
  }

  parseWebhook(headers: WebhookHeaders, rawBody: Buffer): ParsedWebhook {
    const signature = headers[MOCK_SIGNATURE_HEADER];
    if (
      typeof signature !== 'string' ||
      !verifySignature(rawBody, signature, this.options.secret)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as MockEvent;
    return {
      eventId: event.id,
      type: event.type,
      providerRef: event.data.reference,
      outcome: OUTCOMES[event.type] ?? null,
      amount: typeof event.data.amount === 'number' ? event.data.amount : null,
      payload: event as unknown as Record<string, unknown>,
    };
  }

  async refund(): Promise<RefundResult> {
    return { providerRef: `mock_rf_${randomUUID()}`, succeeded: true };
  }

  /** The signed webhook a real gateway would send for this outcome. */
  simulate(
    providerRef: string,
    amount: number,
    outcome: MockPaymentOutcome,
  ): { headers: WebhookHeaders; rawBody: Buffer } {
    const event: MockEvent = {
      id: `evt_${randomUUID()}`,
      type: EVENT_TYPES[outcome],
      data: { reference: providerRef, amount },
    };
    const rawBody = Buffer.from(JSON.stringify(event));
    return {
      headers: { [MOCK_SIGNATURE_HEADER]: signPayload(rawBody, this.options.secret) },
      rawBody,
    };
  }
}
