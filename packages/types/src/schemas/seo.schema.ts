import { z } from 'zod';
import { REDIRECT_STATUS_CODES, type RedirectDto, type RedirectInput } from '../seo/seo';

const path = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(500)
  .refine(
    (v) => v.startsWith('/') || /^https?:\/\/\S+$/.test(v),
    'Start with / (or a full https:// link)',
  );

export const redirectFormSchema = z
  .object({
    fromPath: path.refine(
      (v) => v.startsWith('/'),
      'Old address must be a path on this site, like /old-page',
    ),
    toPath: path,
    statusCode: z.coerce
      .number()
      .refine((v) => (REDIRECT_STATUS_CODES as readonly number[]).includes(v)),
  })
  .refine((v) => v.fromPath.replace(/\/+$/, '') !== v.toPath.replace(/\/+$/, ''), {
    path: ['toPath'],
    message: 'Must differ from the old address',
  });
export type RedirectFormValues = z.infer<typeof redirectFormSchema>;

export const emptyRedirectForm: RedirectFormValues = { fromPath: '', toPath: '', statusCode: 301 };

export const redirectToForm = (r: RedirectDto): RedirectFormValues => ({
  fromPath: r.fromPath,
  toPath: r.toPath,
  statusCode: r.statusCode,
});

export const redirectFormToInput = (v: RedirectFormValues): RedirectInput => ({
  fromPath: v.fromPath.trim(),
  toPath: v.toPath.trim(),
  statusCode: v.statusCode as RedirectInput['statusCode'],
});
