import type { CheckoutTaxLine } from '../localization/localization';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '../enums';
import type { CartItemDto } from '../cart/cart';
import type { ShippingAddress } from '../users/address';
import type { PaymentAttemptDto, PaymentOptionDto, PaymentSessionDto } from '../payments/payment';
import type { ShippingOptionDto } from '../shipping/shipping';
import type { CouponResultDto, DiscountLineDto } from '../promotions/promotion';
import type { CheckoutGiftCardDto, CheckoutLoyaltyDto } from '../loyalty/loyalty';

export type BadgeTone = 'gray' | 'green' | 'yellow' | 'red' | 'blue';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  COD_CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
};

export const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  PENDING_PAYMENT: 'yellow',
  PAID: 'blue',
  COD_CONFIRMED: 'blue',
  PROCESSING: 'blue',
  PACKED: 'blue',
  SHIPPED: 'yellow',
  OUT_FOR_DELIVERY: 'yellow',
  DELIVERED: 'green',
  CANCELLED: 'gray',
  RETURN_REQUESTED: 'red',
  RETURNED: 'gray',
  REFUNDED: 'gray',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: 'Card',
  WALLET: 'Wallet',
  BANK_TRANSFER: 'Bank transfer',
  COD: 'Cash on delivery',
  GIFT_CARD: 'Gift card',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  AUTHORIZED: 'Authorized',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, BadgeTone> = {
  PENDING: 'yellow',
  AUTHORIZED: 'blue',
  PAID: 'green',
  FAILED: 'red',
  REFUNDED: 'gray',
  PARTIALLY_REFUNDED: 'blue',
  CANCELLED: 'gray',
};

/** What a vendor can move its sub-order to from each status. */
export const VENDOR_ORDER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAID: ['PROCESSING', 'CANCELLED'],
  COD_CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
};

/** Sub-order statuses from which the customer / admin may still cancel (nothing has shipped). */
export const CANCELLABLE_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'COD_CONFIRMED',
  'PROCESSING',
  'PACKED',
];

/** Customer-facing progress steps. */
export const ORDER_PROGRESS: OrderStatus[] = [
  'COD_CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
];

export const ORDER_REASON_MIN = 5;

// ---------------------------------------------------------------- checkout

export interface CheckoutGroup {
  vendor: { id: string; name: string; slug: string };
  items: CartItemDto[];
  subtotal: number;
  shipping: number;
  /** Delivery choices for this seller's parcel (cheapest first). */
  shippingOptions: ShippingOptionDto[];
  /** The option the totals use. */
  shippingRateId: string | null;
  shippingMethod: string;
  estimatedDays: string | null;
  /** Parcel weight used for weight-based rates (0 when products have no weight). */
  weightGrams: number;
  /** Discounts on this seller's items / shipping. */
  discount: number;
  /** Part of `discount` paid by the seller (seller coupons). */
  sellerFundedDiscount: number;
  /** Share of points + gift card used for this seller's items (store-funded). */
  tenders: number;
  /** All tax on this seller's items (included + added). */
  tax: number;
  /** Part of `tax` added on top of prices (exclusive rates). */
  taxAdded: number;
  taxLines: CheckoutTaxLine[];
}

export interface CheckoutQuoteDto {
  currency: string;
  groups: CheckoutGroup[];
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  /** All tax (included in prices + added). */
  taxTotal: number;
  /** Tax added on top of prices; part of grandTotal. */
  taxAdded: number;
  /** Tax already included in prices (informational). */
  taxIncluded: number;
  /** COD fee applied to this quote (0 unless the selected method is COD). */
  codFee: number;
  grandTotal: number;
  /** Methods the customer can choose right now. */
  paymentMethods: PaymentMethod[];
  /** Every method with availability + reason, for the payment picker. */
  paymentOptions: PaymentOptionDto[];
  /** The method these totals were calculated for. */
  selectedPaymentMethod: PaymentMethod | null;
  canPlace: boolean;
  problems: string[];
  /** Default flat-rate threshold; only meaningful when no shipping zone matched (`shippingZone` null). */
  freeShippingAbove: number;
  /** Shipping zone that matched the destination; null = store default rate / no address yet. */
  shippingZone: string | null;
  /** Automatic promotions and the coupon, as applied. */
  discounts: DiscountLineDto[];
  coupon: CouponResultDto | null;
  /** Signed-in customers: points balance and what this order uses (null for guests). */
  loyalty: CheckoutLoyaltyDto | null;
  giftCard: CheckoutGiftCardDto | null;
}

export interface PlaceOrderInput {
  /** Required for guests. */
  email?: string;
  /** A saved address (signed-in) … */
  addressId?: string;
  /** … or a new one. */
  address?: ShippingAddress;
  saveAddress?: boolean;
  paymentMethod: PaymentMethod;
  /** Chosen delivery option per seller: { vendorId: rateId }. Cheapest when omitted. */
  shippingRateIds?: Record<string, string>;
  couponCode?: string | null;
  redeemPoints?: boolean;
  giftCardCode?: string | null;
  customerNote?: string | null;
  /** Random id per checkout attempt — a double click never creates two orders. */
  idempotencyKey: string;
}

/** Result of placing an order. Online methods also return the gateway page to send the customer to. */
export interface PlaceOrderResultDto {
  order: OrderDto;
  payment: PaymentSessionDto | null;
}

// ---------------------------------------------------------------- orders

export interface OrderItemDto {
  id: string;
  productName: string;
  productSlug: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  /** Units the customer can still return (delivered, within the window, not already in a return). */
  returnableQuantity: number;
}

export interface ShipmentDto {
  courierName: string | null;
  /** Courier tracking page, when the courier has a tracking link template. */
  trackingUrl: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface OrderHistoryEntry {
  status: OrderStatus;
  note: string | null;
  vendorName: string | null;
  createdAt: string;
}

export interface VendorOrderDto {
  id: string;
  vendor: { id: string; name: string; slug: string };
  status: OrderStatus;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  taxAdded: number;
  shippingMethod: string | null;
  items: OrderItemDto[];
  shipment: ShipmentDto | null;
  /** Last day a return can be requested (delivered sub-orders only). */
  returnableUntil: string | null;
}

/** Full order (customer, guest tracking, admin). */
export interface OrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  email: string;
  currency: string;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  taxTotal: number;
  /** Part of taxTotal added on top of prices (the rest was included). */
  taxAdded: number;
  grandTotal: number;
  couponCode: string | null;
  loyaltyDiscount: number;
  giftCardTotal: number;
  shippingAddress: ShippingAddress;
  customerNote: string | null;
  placedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  canCancel: boolean;
  /** Online order still waiting for payment (and not expired): show "Pay now". */
  canPay: boolean;
  /** Unpaid online orders are cancelled after this moment. */
  paymentExpiresAt: string | null;
  payments: PaymentAttemptDto[];
  vendorOrders: VendorOrderDto[];
  history: OrderHistoryEntry[];
}

export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  grandTotal: number;
  currency: string;
  itemCount: number;
  imageUrl: string | null;
  vendorCount: number;
  placedAt: string;
}

export interface AdminOrderListItem extends OrderSummaryDto {
  email: string;
  customerName: string;
  city: string;
}

/** Vendor sub-order list row. */
export interface VendorOrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  itemCount: number;
  subtotal: number;
  netAmount: number;
  currency: string;
  customerName: string;
  city: string;
  paymentMethod: PaymentMethod;
  placedAt: string;
}

/** Vendor sub-order detail. */
export interface VendorOrderDetailDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  items: OrderItemDto[];
  subtotal: number;
  shippingTotal: number;
  /** Tax on this sub-order; it belongs to the seller (included in netAmount). */
  taxTotal: number;
  taxAdded: number;
  commissionAmount: number;
  netAmount: number;
  /** Delivery option the customer chose, and its default courier. */
  shippingMethod: string | null;
  suggestedCourierId: string | null;
  customer: { name: string; email: string; phone: string };
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerNote: string | null;
  placedAt: string;
  shipment: ShipmentDto | null;
  history: OrderHistoryEntry[];
  nextStatuses: OrderStatus[];
}

export interface OrderListQuery {
  status?: OrderStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface VendorOrderStatusInput {
  status: OrderStatus;
  /** Required when marking SHIPPED. */
  trackingNumber?: string;
  /** Courier carrying the parcel (SHIPPED). */
  courierId?: string;
  /** Required when cancelling. */
  note?: string;
}

export interface CancelOrderInput {
  reason: string;
}

export interface TrackOrderInput {
  orderNumber: string;
  email: string;
}
