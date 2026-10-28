import { render } from '@react-email/components';
import type { EmailTemplateKey, EmailTemplateOverrides } from '@ecommerce/types';
import { templateRegistry } from './registry';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Admin edits from the EmailTemplate table. Empty values mean "use the default". */
export interface TemplateOverride extends EmailTemplateOverrides {
  subject?: string | null;
}

/** "Hi {{ firstName }}" → "Hi Sana" (unknown placeholders become empty). */
export function fillPlaceholders(text: string, data: Record<string, unknown>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => {
    const v = data[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * Renders any catalogue email to subject + HTML + plain text.
 * Overrides (subject, and heading / body / button text for generic-layout emails) come from the admin template editor.
 */
export async function renderEmail(
  key: EmailTemplateKey,
  data: Record<string, unknown> = {},
  override?: TemplateOverride | string | null,
): Promise<RenderedEmail> {
  const def = templateRegistry[key];
  if (!def) throw new Error(`Unknown email template: ${key}`);
  const o: TemplateOverride =
    typeof override === 'string' ? { subject: override } : (override ?? {});

  const merged: Record<string, unknown> = { ...data };
  if (def.blocks) {
    for (const field of ['heading', 'body', 'ctaLabel'] as const) {
      const value = o[field];
      if (value && value.trim()) merged[field] = fillPlaceholders(value, data);
    }
  }
  const element = def.render(merged);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  const subject =
    o.subject && o.subject.trim() ? fillPlaceholders(o.subject, data) : def.subject(data);
  return { subject, html, text };
}
