import { z } from 'zod';
import type { IssueGiftCardInput } from '../loyalty/loyalty';

export const issueGiftCardSchema = z.object({
  amount: z.number({ invalid_type_error: 'Enter an amount' }).min(1, 'At least 1').max(100000),
  recipientEmail: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
  senderName: z.string().trim().max(80),
  message: z.string().trim().max(300),
  expiresAt: z.string(),
});
export type IssueGiftCardFormValues = z.infer<typeof issueGiftCardSchema>;

export const emptyIssueGiftCardForm: IssueGiftCardFormValues = {
  amount: 50,
  recipientEmail: '',
  senderName: '',
  message: '',
  expiresAt: '',
};

export const issueGiftCardToInput = (v: IssueGiftCardFormValues): IssueGiftCardInput => ({
  amount: v.amount,
  recipientEmail: v.recipientEmail || null,
  senderName: v.senderName || null,
  message: v.message || null,
  expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : null,
});
