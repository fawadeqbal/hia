import {
  EMAIL_VARIABLES,
  REQUIRED_EMAILS,
  SENDER_CONTENT_EMAILS,
  type EmailTemplateInput,
  type EmailTemplateKey,
  type EmailTemplateOverrides,
} from '@ecommerce/types';

export const LIMITS = { subject: 150, heading: 150, body: 5000, ctaLabel: 40 } as const;

/** Placeholders used in a text: "Hi {{ firstName }}" → ["firstName"]. */
export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!);
}

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * Validates an edit and returns the normalised values (empty = default), or a list of problems.
 * Rules: campaign / newsletter content is not editable here; security / order emails stay on;
 * only generic-layout emails have editable blocks; placeholders must be known variables.
 */
export function validateTemplateEdit(
  key: EmailTemplateKey,
  input: EmailTemplateInput,
  opts: { blocks: boolean; extraVariables?: string[] },
): { problems: string[]; subject: string | null; overrides: EmailTemplateOverrides | null } {
  const problems: string[] = [];
  const subject = clean(input.subject);
  const o = input.overrides ?? {};
  const overrides: EmailTemplateOverrides = {
    heading: clean(o.heading),
    body: clean(o.body),
    ctaLabel: clean(o.ctaLabel),
  };
  const hasBlocks = Object.values(overrides).some((v) => v !== null);

  if (SENDER_CONTENT_EMAILS.includes(key) && (subject || hasBlocks))
    problems.push('This email is written in the campaign editor (Marketing → Campaigns)');
  if (REQUIRED_EMAILS.includes(key) && !input.isActive)
    problems.push('This email is required and cannot be turned off');
  if (!opts.blocks && hasBlocks) problems.push('Only the subject of this email can be changed');

  const known = new Set<string>([...EMAIL_VARIABLES, ...(opts.extraVariables ?? [])]);
  const fields: [keyof typeof LIMITS, string | null][] = [
    ['subject', subject],
    ['heading', overrides.heading ?? null],
    ['body', overrides.body ?? null],
    ['ctaLabel', overrides.ctaLabel ?? null],
  ];
  for (const [field, value] of fields) {
    if (!value) continue;
    if (value.length > LIMITS[field])
      problems.push(`${field} is too long (at most ${LIMITS[field]} characters)`);
    const unknown = placeholdersIn(value).filter((p) => !known.has(p));
    if (unknown.length)
      problems.push(`Unknown placeholder ${unknown.map((u) => `{{${u}}}`).join(', ')} in ${field}`);
  }
  return { problems, subject, overrides: hasBlocks ? overrides : null };
}
