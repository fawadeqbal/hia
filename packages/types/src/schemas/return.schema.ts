import { z } from 'zod';
import { RETURN_REASONS, type CreateReturnInput } from '../returns/return';

/** Customer return form: a quantity per delivered line (0 = not returned). */
export const returnFormSchema = z
  .object({
    lines: z.array(
      z.object({
        orderItemId: z.string(),
        max: z.number(),
        quantity: z.number({ invalid_type_error: 'Enter a number' }).int().min(0),
      }),
    ),
    reason: z.enum(RETURN_REASONS),
    comments: z.string().trim().max(1000, 'At most 1000 characters'),
  })
  .superRefine((v, ctx) => {
    v.lines.forEach((l, i) => {
      if (l.quantity > l.max)
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, 'quantity'],
          message: `At most ${l.max}`,
        });
    });
    if (!v.lines.some((l) => l.quantity > 0))
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Choose at least one item to return',
      });
    if (v.reason === 'OTHER' && v.comments.length < 5)
      ctx.addIssue({ code: 'custom', path: ['comments'], message: 'Tell us what is wrong' });
  });
export type ReturnFormValues = z.infer<typeof returnFormSchema>;

export function returnFormToInput(
  v: ReturnFormValues,
  orderNumber: string,
  vendorOrderId: string,
): CreateReturnInput {
  return {
    orderNumber,
    vendorOrderId,
    items: v.lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity })),
    reason: v.reason,
    comments: v.comments.trim() || null,
  };
}
