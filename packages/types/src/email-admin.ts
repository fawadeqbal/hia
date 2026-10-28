import { EmailTemplateKey, MARKETING_EMAILS } from './email';
import type { BadgeTone } from './orders/order';

/** Editable blocks of a template (generic layout emails). `{{variable}}` placeholders are filled from the email data. */
export interface EmailTemplateOverrides {
  heading?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
}

/** Security / order emails that can never be switched off. */
export const REQUIRED_EMAILS: EmailTemplateKey[] = [
  EmailTemplateKey.VERIFY_EMAIL,
  EmailTemplateKey.PASSWORD_RESET,
  EmailTemplateKey.LOGIN_OTP,
  EmailTemplateKey.ORDER_CONFIRMATION,
];

/** Content is written per send (campaign editor), so the template itself is not editable. */
export const SENDER_CONTENT_EMAILS: EmailTemplateKey[] = [
  EmailTemplateKey.CAMPAIGN,
  EmailTemplateKey.NEWSLETTER,
];

export const EMAIL_GROUP_LABELS: Record<string, string> = {
  account: 'Account',
  order: 'Orders',
  payment: 'Payments',
  return: 'Returns',
  marketing: 'Marketing',
  loyalty: 'Loyalty',
  giftcard: 'Gift cards',
  vendor: 'Sellers',
  admin: 'Staff',
  support: 'Support',
};

/** Placeholders admins can use; each is filled only when that email has the value. */
export const EMAIL_VARIABLES = [
  'firstName',
  'storeName',
  'orderNumber',
  'total',
  'trackingNumber',
  'rmaNumber',
  'productName',
  'vendorName',
  'code',
] as const;

export const emailGroupOf = (key: string): string => key.split('.')[0] ?? 'other';

/** "order.vendor-confirmed" → "Vendor confirmed" */
export function emailTemplateName(key: string): string {
  const rest = key.split('.').slice(1).join(' ').replace(/-/g, ' ');
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export const isMarketingEmail = (key: string) => (MARKETING_EMAILS as string[]).includes(key);

export interface EmailTemplateListItem {
  key: EmailTemplateKey;
  name: string;
  group: string;
  marketing: boolean;
  required: boolean;
  /** Heading / text / button can be edited (generic layout). Otherwise only the subject. */
  blocks: boolean;
  /** False for campaign / newsletter (content comes from the campaign). */
  editable: boolean;
  isActive: boolean;
  customized: boolean;
  /** Subject override, null = default. */
  subject: string | null;
  updatedAt: string | null;
}

export interface EmailTemplateDetail extends EmailTemplateListItem {
  defaultSubject: string;
  overrides: EmailTemplateOverrides;
}

export interface EmailTemplateInput {
  /** null / '' = default subject. */
  subject: string | null;
  overrides: EmailTemplateOverrides;
  isActive: boolean;
}

export interface EmailPreviewDto {
  subject: string;
  html: string;
}

// ------------------------------------------------------------------ log
export const EMAIL_LOG_STATUSES = [
  'QUEUED',
  'SENT',
  'DELIVERED',
  'BOUNCED',
  'COMPLAINED',
  'FAILED',
  'SUPPRESSED',
] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];
export const EMAIL_LOG_STATUS_TONES: Record<EmailLogStatus, BadgeTone> = {
  QUEUED: 'yellow',
  SENT: 'green',
  DELIVERED: 'green',
  BOUNCED: 'red',
  COMPLAINED: 'red',
  FAILED: 'red',
  SUPPRESSED: 'gray',
};

export interface EmailLogItem {
  id: string;
  templateKey: string;
  to: string;
  subject: string | null;
  status: EmailLogStatus;
  error: string | null;
  provider: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface EmailLogQuery {
  status?: EmailLogStatus;
  template?: string;
  /** Recipient address (contains). */
  search?: string;
  page?: number;
  limit?: number;
}

export interface EmailSuppressionDto {
  id: string;
  email: string;
  /** BOUNCE | COMPLAINT | MANUAL */
  reason: string;
  createdAt: string;
}
