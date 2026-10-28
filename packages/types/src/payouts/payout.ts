import type { BadgeTone } from '../orders/order';

export const PAYOUT_STATUSES = ['PENDING', 'PROCESSING', 'PAID', 'FAILED'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  PENDING: 'To pay',
  PROCESSING: 'Transfer sent',
  PAID: 'Paid',
  FAILED: 'Failed',
};
export const PAYOUT_STATUS_TONES: Record<PayoutStatus, BadgeTone> = {
  PENDING: 'yellow',
  PROCESSING: 'blue',
  PAID: 'green',
  FAILED: 'red',
};

/** One delivered sub-order in a payout (or waiting for one). */
export interface PayoutItemDto {
  vendorOrderId: string;
  orderNumber: string;
  deliveredAt: string | null;
  /** Subtotal + shipping − seller-funded discounts. */
  gross: number;
  /** Platform commission (after giving back the share on refunded items). */
  commission: number;
  /** Return refunds paid to the customer. */
  refunded: number;
  net: number;
}

export interface PayoutBankDto {
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  iban: string | null;
}

export interface PayoutDto {
  id: string;
  vendor: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  gross: number;
  commission: number;
  refunds: number;
  net: number;
  currency: string;
  status: PayoutStatus;
  reference: string | null;
  paidAt: string | null;
  createdAt: string;
  itemCount: number;
  items: PayoutItemDto[];
  bank: PayoutBankDto | null;
}

/** Seller finance dashboard. */
export interface VendorEarningsDto {
  currency: string;
  /** Ready for the next payout. */
  available: number;
  /** Delivered but still in the hold period / with an open return. */
  onHold: number;
  /** In payouts not paid yet. */
  inPayouts: number;
  paidTotal: number;
  lifetimeGross: number;
  lifetimeCommission: number;
  holdDays: number;
  minimumAmount: number;
  availableItems: PayoutItemDto[];
  onHoldItems: (PayoutItemDto & { releaseAt: string | null; reason: string })[];
}

export interface GeneratePayoutsResultDto {
  created: number;
  total: number;
  skippedBelowMinimum: number;
}

export interface MarkPayoutInput {
  status: 'PROCESSING' | 'PAID' | 'FAILED';
  /** Bank transfer reference (required for PAID). */
  reference?: string;
}
