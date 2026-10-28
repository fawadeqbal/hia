import type { CustomerSegment } from '../users/customer';
import type { BadgeTone } from '../orders/order';

// ------------------------------------------------------------------ campaigns
export const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  SENDING: 'Sending',
  SENT: 'Sent',
  CANCELLED: 'Cancelled',
};
export const CAMPAIGN_STATUS_TONES: Record<CampaignStatus, BadgeTone> = {
  DRAFT: 'gray',
  SCHEDULED: 'blue',
  SENDING: 'yellow',
  SENT: 'green',
  CANCELLED: 'gray',
};

/** Who receives a campaign. Opted-out people, unsubscribed and suppressed addresses are always skipped. */
export const CAMPAIGN_AUDIENCES = ['subscribers', 'customers', 'everyone'] as const;
export type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[number];
export const CAMPAIGN_AUDIENCE_LABELS: Record<CampaignAudience, string> = {
  subscribers: 'Newsletter subscribers',
  customers: 'Customers',
  everyone: 'Subscribers + customers',
};

export interface CampaignContent {
  heading: string;
  /** Plain text; each line becomes a paragraph. */
  body: string;
  ctaLabel: string | null;
  /** Site path (/products) or full https link. */
  ctaUrl: string | null;
}

export interface CampaignStats {
  recipients: number;
  queued: number;
  skipped: number;
}

export interface CampaignDto {
  id: string;
  name: string;
  subject: string;
  content: CampaignContent;
  audience: CampaignAudience;
  /** Customers only: limit to one segment (null = all customers). */
  segment: CustomerSegment | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  stats: CampaignStats | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignInput {
  name: string;
  subject: string;
  content: CampaignContent;
  audience: CampaignAudience;
  segment: CustomerSegment | null;
}

// ------------------------------------------------------------------ subscribers
export const SUBSCRIBER_STATUSES = ['CONFIRMED', 'PENDING', 'UNSUBSCRIBED'] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];
export const SUBSCRIBER_STATUS_LABELS: Record<SubscriberStatus, string> = {
  CONFIRMED: 'Subscribed',
  PENDING: 'Awaiting confirmation',
  UNSUBSCRIBED: 'Unsubscribed',
};
export const SUBSCRIBER_STATUS_TONES: Record<SubscriberStatus, BadgeTone> = {
  CONFIRMED: 'green',
  PENDING: 'yellow',
  UNSUBSCRIBED: 'gray',
};

export interface SubscriberDto {
  id: string;
  email: string;
  status: SubscriberStatus;
  source: string | null;
  /** Has a customer account. */
  isCustomer: boolean;
  createdAt: string;
}

export interface SubscriberQuery {
  status?: SubscriberStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/** Storefront links in emails: email + HMAC signature (no login needed). */
export interface SignedEmailInput {
  email: string;
  sig: string;
}
