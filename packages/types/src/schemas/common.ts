import { z } from 'zod';
import { SLUG_REGEX } from '../utils/slugify';

/** Optional slug field: '' means "generate from name". */
export const optionalSlugField = z
  .string()
  .trim()
  .max(140)
  .refine((v) => v === '' || SLUG_REGEX.test(v), 'Lowercase letters, numbers and hyphens only');

/** Optional http(s) URL field: '' means "not set". */
export const optionalUrlField = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || /^https?:\/\/\S+$/.test(v),
    'Must be a valid URL starting with http:// or https://',
  );

/** <input type="datetime-local"> value ("2026-10-12T09:30", browser local time) ↔ ISO. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const localInputToIso = (v: string): string | null =>
  v.trim() === '' ? null : new Date(v).toISOString();

/** '' -> null, otherwise trimmed. */
export const emptyToNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());
