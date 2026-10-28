/**
 * Every email the shop sends. Email is the only notification channel.
 */
export const EmailTemplateKey = {
  // Account
  WELCOME: 'account.welcome',
  VERIFY_EMAIL: 'account.verify-email',
  LOGIN_OTP: 'account.login-otp',
  PASSWORD_RESET: 'account.password-reset',
  PASSWORD_CHANGED: 'account.password-changed',
  ACCOUNT_DELETED: 'account.deleted',

  // Orders (customer)
  ORDER_CONFIRMATION: 'order.confirmation',
  PAYMENT_FAILED: 'order.payment-failed',
  ORDER_CONFIRMED_BY_VENDOR: 'order.vendor-confirmed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_OUT_FOR_DELIVERY: 'order.out-for-delivery',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',

  // Returns & refunds
  RETURN_RECEIVED: 'return.received',
  RETURN_APPROVED: 'return.approved',
  RETURN_REJECTED: 'return.rejected',
  REFUND_PROCESSED: 'return.refund-processed',

  // Customer updates
  BACK_IN_STOCK: 'marketing.back-in-stock',
  WISHLIST_PRICE_DROP: 'marketing.price-drop',
  REVIEW_REQUEST: 'marketing.review-request',

  // To the shop (admin)
  VENDOR_NEW_ORDER: 'vendor.new-order',
  VENDOR_LOW_STOCK: 'vendor.low-stock',
  VENDOR_RETURN_REQUEST: 'vendor.return-request',
  ADMIN_NEW_TICKET: 'admin.new-ticket',

  // Contact / repair inquiries
  TICKET_CREATED: 'support.ticket-created',
} as const;
export type EmailTemplateKey = (typeof EmailTemplateKey)[keyof typeof EmailTemplateKey];

/** Optional emails respect the customer's opt-out; transactional emails are always sent. */
export const MARKETING_EMAILS: EmailTemplateKey[] = [
  EmailTemplateKey.WISHLIST_PRICE_DROP,
  EmailTemplateKey.REVIEW_REQUEST,
];

export interface EmailJobPayload {
  template: EmailTemplateKey;
  to: string;
  data?: Record<string, unknown>;
  /** EmailLog row id created when the job was enqueued. */
  logId?: string;
  userId?: string;
}
