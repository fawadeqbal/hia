import type { BadgeTone } from '../orders/order';

/**
 * Inquiries: messages from the website Contact page — chair repair requests, wholesale / bulk quotes and
 * general questions. Stored as `Ticket` rows (+ `TicketMessage` for the message and staff notes).
 */
export const INQUIRY_TOPICS = ['REPAIR', 'QUOTE', 'GENERAL'] as const;
export type InquiryTopic = (typeof INQUIRY_TOPICS)[number];

export const INQUIRY_TOPIC_LABELS: Record<InquiryTopic, string> = {
  REPAIR: 'Chair repair / maintenance',
  QUOTE: 'Wholesale, bulk or institutional quote',
  GENERAL: 'General question',
};

/** Same values as the Prisma `TicketStatus` enum. */
export const INQUIRY_STATUSES = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  OPEN: 'New',
  PENDING: 'In progress',
  RESOLVED: 'Done',
  CLOSED: 'Closed',
};

export const INQUIRY_STATUS_TONES: Record<InquiryStatus, BadgeTone> = {
  OPEN: 'yellow',
  PENDING: 'blue',
  RESOLVED: 'green',
  CLOSED: 'gray',
};

/** Body of POST /inquiries (website contact form). */
export interface InquiryInput {
  topic: InquiryTopic;
  name: string;
  phone: string;
  /** Optional — many customers prefer a phone call. Empty string = none. */
  email?: string | null;
  company?: string | null;
  message: string;
}

export interface InquiryCreatedDto {
  number: string;
}

export interface InquiryListItem {
  id: string;
  number: string;
  topic: InquiryTopic;
  status: InquiryStatus;
  name: string;
  phone: string | null;
  email: string | null;
  subject: string;
  /** First line of the customer's message. */
  preview: string;
  createdAt: string;
}

export interface InquiryNoteDto {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

export interface InquiryDto extends InquiryListItem {
  message: string;
  notes: InquiryNoteDto[];
  updatedAt: string;
}

export interface InquiryStatusInput {
  status: InquiryStatus;
}

export interface InquiryNoteInput {
  body: string;
}
