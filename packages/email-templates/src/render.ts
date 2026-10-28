import { render } from '@react-email/components';
import type { EmailTemplateKey } from '@ecommerce/types';
import { templateRegistry } from './registry';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Renders any email to subject + HTML + plain text. */
export async function renderEmail(
  key: EmailTemplateKey,
  data: Record<string, unknown> = {},
): Promise<RenderedEmail> {
  const def = templateRegistry[key];
  if (!def) throw new Error(`Unknown email template: ${key}`);
  const element = def.render(data);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: def.subject(data), html, text };
}
