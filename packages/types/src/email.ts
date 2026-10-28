/**
 * Every email the platform sends (scope section 6.2).
 * Email is the ONLY notification channel.
 */
export const EmailTemplateKey = {
  // Account
  WELCOME: 'account.welcome',
  VERIFY_EMAIL: 'account.verify-email',
  LOGIN_OTP: 'account.login-otp',
  PASSWORD_RESET: 'account.password-reset',
  PASSWORD_CHANGED: 'account.password-changed',
  ACCOUNT_DELETED: 'account.deleted',
  STAFF_INVITATION: 'account.staff-invitation',

  // Orders (customer)
  ORDER_CONFIRMATION: 'order.confirmation',
  PAYMENT_RECEIVED: 'order.payment-received',
  PAYMENT_FAILED: 'order.payment-failed',
  ORDER_CONFIRMED_BY_VENDOR: 'order.vendor-confirmed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_OUT_FOR_DELIVERY: 'order.out-for-delivery',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_INVOICE: 'order.invoice',

  // Returns & refunds
  RETURN_RECEIVED: 'return.received',
  RETURN_APPROVED: 'return.approved',
  RETURN_REJECTED: 'return.rejected',
  REFUND_PROCESSED: 'return.refund-processed',

  // Engagement & marketing
  ABANDONED_CART: 'marketing.abandoned-cart',
  BACK_IN_STOCK: 'marketing.back-in-stock',
  WISHLIST_PRICE_DROP: 'marketing.price-drop',
  REVIEW_REQUEST: 'marketing.review-request',
  LOYALTY_POINTS_EARNED: 'loyalty.points-earned',
  LOYALTY_POINTS_EXPIRING: 'loyalty.points-expiring',
  REFERRAL_REWARD: 'loyalty.referral-reward',
  NEWSLETTER: 'marketing.newsletter',
  NEWSLETTER_CONFIRM: 'marketing.newsletter-confirm',
  WIN_BACK: 'marketing.win-back',
  CAMPAIGN: 'marketing.campaign',
  GIFT_CARD_RECEIVED: 'giftcard.received',

  // Vendor
  VENDOR_APPLICATION_RECEIVED: 'vendor.application-received',
  VENDOR_APPROVED: 'vendor.approved',
  VENDOR_REJECTED: 'vendor.rejected',
  VENDOR_SUSPENDED: 'vendor.suspended',
  VENDOR_NEW_ORDER: 'vendor.new-order',
  VENDOR_PRODUCT_APPROVED: 'vendor.product-approved',
  VENDOR_PRODUCT_REJECTED: 'vendor.product-rejected',
  VENDOR_LOW_STOCK: 'vendor.low-stock',
  VENDOR_PAYOUT_PROCESSED: 'vendor.payout-processed',
  VENDOR_RETURN_REQUEST: 'vendor.return-request',

  // Admin / staff
  ADMIN_NEW_VENDOR_APPLICATION: 'admin.new-vendor-application',
  ADMIN_NEW_TICKET: 'admin.new-ticket',
  ADMIN_SALES_SUMMARY: 'admin.sales-summary',
  ADMIN_SCHEDULED_REPORT: 'admin.scheduled-report',
  ADMIN_SYSTEM_ALERT: 'admin.system-alert',

  // Support
  TICKET_CREATED: 'support.ticket-created',
  TICKET_REPLY: 'support.ticket-reply',
  TICKET_RESOLVED: 'support.ticket-resolved',
} as const;
export type EmailTemplateKey = (typeof EmailTemplateKey)[keyof typeof EmailTemplateKey];

/** Marketing emails respect the user's opt-out; transactional emails are always sent. */
export const MARKETING_EMAILS: EmailTemplateKey[] = [
  EmailTemplateKey.ABANDONED_CART,
  EmailTemplateKey.WISHLIST_PRICE_DROP,
  EmailTemplateKey.REVIEW_REQUEST,
  EmailTemplateKey.NEWSLETTER,
  EmailTemplateKey.CAMPAIGN,
  EmailTemplateKey.WIN_BACK,
];

export interface EmailJobPayload {
  template: EmailTemplateKey;
  to: string;
  locale?: string;
  data?: Record<string, unknown>;
  /** EmailLog row id created when the job was enqueued. */
  logId?: string;
  userId?: string;
}
