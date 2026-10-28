import { BadRequestException } from '@nestjs/common';
import {
  FAQ_DEFAULT_CATEGORY,
  pageContentSchema,
  type MenuItemDto,
  type PageContent,
  type PublicFaqGroup,
} from '@ecommerce/types';

/** Validates page content with the same zod schema the admin form uses. */
export function parsePageContent(raw: unknown): PageContent {
  const result = pageContentSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? ` at ${issue.path.join('.')}` : '';
    throw new BadRequestException(`Invalid page content${where}: ${issue.message}`);
  }
  return result.data as PageContent;
}

/** Stored content may predate a schema change: never crash the storefront, drop what doesn't parse. */
export function readPageContent(raw: unknown): PageContent {
  const result = pageContentSchema.safeParse(raw);
  return result.success ? (result.data as PageContent) : { blocks: [] };
}

/** Active and inside its (optional) schedule. */
export function isBannerLive(
  b: { isActive: boolean; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
): boolean {
  if (!b.isActive) return false;
  if (b.startsAt && b.startsAt > now) return false;
  if (b.endsAt && b.endsAt <= now) return false;
  return true;
}

interface FlatMenuItem {
  id: string;
  parentId: string | null;
  label: string;
  url: string;
  position: number;
}

/** Flat rows → two-level tree ordered by position. Orphans (parent deleted) are dropped. */
export function buildMenuTree(rows: FlatMenuItem[]): MenuItemDto[] {
  const byPos = (a: FlatMenuItem, b: FlatMenuItem) => a.position - b.position;
  const top = rows.filter((r) => r.parentId === null).sort(byPos);
  return top.map((t) => ({
    id: t.id,
    label: t.label,
    url: t.url,
    position: t.position,
    children: rows
      .filter((r) => r.parentId === t.id)
      .sort(byPos)
      .map((c) => ({ id: c.id, label: c.label, url: c.url, position: c.position, children: [] })),
  }));
}

/** Active FAQs grouped by category (empty category → "General"), groups in first-seen order. */
export function groupFaqs(
  faqs: { id: string; question: string; answer: string; category: string | null }[],
): PublicFaqGroup[] {
  const groups = new Map<string, PublicFaqGroup>();
  for (const f of faqs) {
    const category = f.category?.trim() || FAQ_DEFAULT_CATEGORY;
    if (!groups.has(category)) groups.set(category, { category, items: [] });
    groups.get(category)!.items.push({ id: f.id, question: f.question, answer: f.answer });
  }
  return [...groups.values()];
}
