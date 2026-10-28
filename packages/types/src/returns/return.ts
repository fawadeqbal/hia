import type { ReturnStatus } from '../enums';
import type { BadgeTone } from '../orders/order';

/** Return (RMA) lifecycle. Rules: apps/api/src/modules/returns/return-rules.ts */
export const RETURN_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'ITEMS_RECEIVED',
  'REFUNDED',
  'CLOSED',
] as const;
export type { ReturnStatus };

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved — send items back',
  REJECTED: 'Rejected',
  ITEMS_RECEIVED: 'Items received',
  REFUNDED: 'Refunded',
  CLOSED: 'Closed',
};

export const RETURN_STATUS_TONES: Record<ReturnStatus, BadgeTone> = {
  REQUESTED: 'yellow',
  APPROVED: 'blue',
  REJECTED: 'red',
  ITEMS_RECEIVED: 'blue',
  REFUNDED: 'green',
  CLOSED: 'gray',
};

export const RETURN_REASONS = [
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'MISSING_PARTS',
  'NO_LONGER_NEEDED',
  'OTHER',
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  DAMAGED: 'Arrived damaged',
  WRONG_ITEM: 'Wrong item sent',
  NOT_AS_DESCRIBED: 'Not as described',
  MISSING_PARTS: 'Missing parts or accessories',
  NO_LONGER_NEEDED: 'No longer needed',
  OTHER: 'Other',
};

/** Actions a seller / admin can take next (computed by the API). */
export type ReturnAction = 'approve' | 'reject' | 'receive' | 'refund';

export const RETURN_NOTE_MIN = 5;

export interface ReturnItemDto {
  id: string;
  orderItemId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  condition: string | null;
  restocked: boolean;
}

export interface ReturnRequestDto {
  id: string;
  rmaNumber: string;
  orderNumber: string;
  vendorOrderId: string | null;
  vendor: { id: string; name: string } | null;
  status: ReturnStatus;
  reason: ReturnReason;
  comments: string | null;
  decisionNote: string | null;
  items: ReturnItemDto[];
  /** Value of the returned items (the default refund). */
  itemsTotal: number;
  /** Paid for the returned items (after discounts) + their added tax: the default refund. */
  suggestedRefund: number;
  refundAmount: number | null;
  refundedAt: string | null;
  currency: string;
  /** COD orders are refunded by hand (bank transfer / cash) and recorded with a reference. */
  refundMethod: 'gateway' | 'manual';
  customer: { name: string; email: string };
  createdAt: string;
  updatedAt: string;
  nextActions: ReturnAction[];
  /** Customer may still withdraw the request. */
  canCancel: boolean;
}

export interface ReturnListItem {
  id: string;
  rmaNumber: string;
  orderNumber: string;
  vendorName: string | null;
  customerName: string;
  status: ReturnStatus;
  reason: ReturnReason;
  itemCount: number;
  itemsTotal: number;
  currency: string;
  createdAt: string;
}

export interface ReturnListQuery {
  status?: ReturnStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/** A delivered line the customer can still return (shown on the order page). */
export interface ReturnableLine {
  orderItemId: string;
  quantity: number;
}

export interface CreateReturnInput {
  orderNumber: string;
  vendorOrderId: string;
  items: ReturnableLine[];
  reason: ReturnReason;
  comments?: string | null;
}

export interface ReturnDecisionInput {
  /** Required to reject; optional message when approving. */
  note?: string;
}

export interface ReceiveReturnInput {
  items: { returnItemId: string; condition?: string | null; restock: boolean }[];
}

export interface RefundReturnInput {
  amount: number;
  /** Manual (COD) refunds: bank transfer / receipt reference. */
  reference?: string;
}
