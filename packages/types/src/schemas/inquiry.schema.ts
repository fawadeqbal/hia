import { z } from 'zod';
import { INQUIRY_TOPICS, type InquiryInput } from '../support/inquiry';

export const INQUIRY_MESSAGE_MIN = 10;
export const INQUIRY_MESSAGE_MAX = 3000;
/** Digits with optional +, spaces or dashes, e.g. 0300 1234567 or +92 300 1234567. */
export const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/;

/** Website contact form (Contact page). */
export const inquiryFormSchema = z.object({
  topic: z.enum(INQUIRY_TOPICS),
  name: z.string().trim().min(2, 'Enter your name').max(100),
  phone: z.string().trim().regex(PHONE_PATTERN, 'Enter a valid phone number'),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email'),
  company: z.string().trim().max(120),
  message: z
    .string()
    .trim()
    .min(INQUIRY_MESSAGE_MIN, `Tell us a bit more (at least ${INQUIRY_MESSAGE_MIN} characters)`)
    .max(INQUIRY_MESSAGE_MAX),
});

export type InquiryFormValues = z.infer<typeof inquiryFormSchema>;

export const emptyInquiryForm = (topic: InquiryFormValues['topic'] = 'GENERAL'): InquiryFormValues => ({
  topic,
  name: '',
  phone: '',
  email: '',
  company: '',
  message: '',
});

export const inquiryFormToInput = (v: InquiryFormValues): InquiryInput => ({
  topic: v.topic,
  name: v.name,
  phone: v.phone,
  email: v.email || null,
  company: v.company || null,
  message: v.message,
});
