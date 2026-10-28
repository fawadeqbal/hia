import type { PageContent, PublishState } from './cms';

export interface BlogCategoryDto {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

export interface BlogCategoryInput {
  name: string;
  /** Generated from the name when omitted. */
  slug?: string;
}

export interface BlogCategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface BlogPostListItem {
  id: string;
  title: string;
  slug: string;
  status: PublishState;
  /** Published but dated in the future. */
  isScheduled: boolean;
  category: BlogCategoryRef | null;
  authorName: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface BlogPostDto extends BlogPostListItem {
  excerpt: string | null;
  content: PageContent;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface BlogPostInput {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content: PageContent;
  categoryId?: string | null;
  tags?: string[];
  coverImageUrl?: string | null;
  status: PublishState;
  /** Optional publish date (ISO). In the future = scheduled. Defaults to now on first publish. */
  publishedAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface BlogPostQuery {
  page?: number;
  limit?: number;
  /** Category slug. */
  category?: string;
  tag?: string;
}

/** Storefront card. */
export interface PublicBlogCard {
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  category: BlogCategoryRef | null;
  tags: string[];
  authorName: string | null;
  publishedAt: string;
  readingMinutes: number;
}

export interface PublicBlogPost extends PublicBlogCard {
  content: PageContent;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
  related: PublicBlogCard[];
}

export interface SitemapEntries {
  pages: { slug: string; updatedAt: string }[];
  posts: { slug: string; updatedAt: string }[];
}

export const MAX_BLOG_TAGS = 10;

/** ~200 words per minute over headings and paragraphs; at least 1 minute. */
export function readingMinutes(content: PageContent): number {
  const words = content.blocks
    .map((b) => (b.type === 'heading' || b.type === 'paragraph' ? b.text : ''))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** "Summer Sale, guides ,  Tips" → ["summer-sale", "guides", "tips"] (unique, max MAX_BLOG_TAGS). */
export function parseTags(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(',');
  const tags = list
    .map((t) =>
      t
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter((t) => t.length > 0 && t.length <= 30);
  return [...new Set(tags)].slice(0, MAX_BLOG_TAGS);
}
