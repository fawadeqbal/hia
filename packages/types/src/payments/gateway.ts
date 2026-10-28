import type { PaymentMethod, PaymentStatus } from '../enums';

/** A credential the admin enters for a gateway. Secret values are stored encrypted and never sent back. */
export interface GatewayFieldDef {
  key: string;
  label: string;
  secret: boolean;
  hint?: string;
}

export interface GatewayDefinition {
  code: string;
  name: string;
  description: string;
  methods: PaymentMethod[];
  fields: GatewayFieldDef[];
  /** Fake money; refused in production unless PAYMENT_ALLOW_MOCK_IN_PRODUCTION=true. */
  testOnly?: boolean;
}

/**
 * Gateways the API can talk to. Adding a real gateway (Safepay, PayFast…) = a definition here +
 * a provider class in apps/api/src/modules/payments/providers + a case in the provider factory.
 */
export const PAYMENT_GATEWAYS: GatewayDefinition[] = [
  {
    code: 'mock',
    name: 'Test gateway',
    description: 'Hosted payment page for development and demos. No real money moves.',
    methods: ['CARD', 'WALLET', 'BANK_TRANSFER'],
    fields: [
      {
        key: 'webhookSecret',
        label: 'Webhook signing secret',
        secret: true,
        hint: 'Leave empty to use PAYMENT_WEBHOOK_SECRET from .env.',
      },
    ],
    testOnly: true,
  },
  {
    code: 'stripe',
    name: 'Stripe',
    description: 'Cards and wallets (Apple Pay, Google Pay) on the Stripe hosted checkout page.',
    methods: ['CARD', 'WALLET'],
    fields: [
      {
        key: 'secretKey',
        label: 'Secret key',
        secret: true,
        hint: 'sk_test_… (test mode) or sk_live_… — Stripe dashboard → Developers → API keys.',
      },
      {
        key: 'webhookSecret',
        label: 'Webhook signing secret',
        secret: true,
        hint: 'whsec_… from the webhook endpoint (or `stripe listen`) pointing at the webhook URL below.',
      },
    ],
  },
];

export const GATEWAY_STATUSES = ['ACTIVE', 'STANDBY', 'DISABLED', 'BLOCKED'] as const;
export type GatewayStatus = (typeof GATEWAY_STATUSES)[number];
export const GATEWAY_STATUS_LABELS: Record<GatewayStatus, string> = {
  ACTIVE: 'Active at checkout',
  STANDBY: 'Enabled (backup)',
  DISABLED: 'Off',
  BLOCKED: 'Blocked in production',
};
export const GATEWAY_STATUS_TONES: Record<GatewayStatus, 'green' | 'blue' | 'gray' | 'red'> = {
  ACTIVE: 'green',
  STANDBY: 'blue',
  DISABLED: 'gray',
  BLOCKED: 'red',
};

export interface PaymentGatewayDto {
  code: string;
  name: string;
  description: string;
  status: GatewayStatus;
  isEnabled: boolean;
  isTestMode: boolean;
  /** Offered at checkout. */
  methods: PaymentMethod[];
  /** What the gateway supports. */
  availableMethods: PaymentMethod[];
  position: number;
  fields: (GatewayFieldDef & { isSet: boolean; preview: string | null })[];
  /** Give this to the gateway as its webhook / IPN URL. */
  webhookUrl: string;
  updatedAt: string | null;
}

export interface PaymentGatewayInput {
  isEnabled: boolean;
  isTestMode: boolean;
  methods: PaymentMethod[];
  position: number;
  /** Only the fields to change; '' clears a field. Omitted fields keep their saved value. */
  credentials?: Record<string, string>;
}

// ------------------------------------------------------------------ logs
export interface PaymentLogItem {
  id: string;
  orderId: string;
  orderNumber: string;
  method: PaymentMethod;
  provider: string;
  status: PaymentStatus;
  amount: number;
  refunded: number;
  currency: string;
  providerRef: string | null;
  createdAt: string;
}

export interface PaymentLogDetail extends PaymentLogItem {
  email: string;
  transactions: {
    id: string;
    type: string;
    amount: number;
    status: string;
    providerRef: string | null;
    createdAt: string;
  }[];
  refunds: {
    id: string;
    amount: number;
    status: PaymentStatus;
    reason: string | null;
    providerRef: string | null;
    createdAt: string;
  }[];
}

export interface PaymentLogQuery {
  status?: PaymentStatus;
  method?: PaymentMethod;
  /** Order number or gateway reference. */
  search?: string;
  page?: number;
  limit?: number;
}

export const WEBHOOK_LOG_STATUSES = ['PROCESSED', 'FAILED', 'PENDING'] as const;
export type WebhookLogStatus = (typeof WEBHOOK_LOG_STATUSES)[number];
export const WEBHOOK_STATUS_TONES: Record<WebhookLogStatus, 'green' | 'red' | 'yellow'> = {
  PROCESSED: 'green',
  FAILED: 'red',
  PENDING: 'yellow',
};

export interface WebhookLogItem {
  id: string;
  provider: string;
  eventId: string;
  type: string;
  status: WebhookLogStatus;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface WebhookLogDetail extends WebhookLogItem {
  payload: unknown;
}

export interface WebhookLogQuery {
  status?: WebhookLogStatus;
  search?: string;
  page?: number;
  limit?: number;
}
