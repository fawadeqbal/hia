import type { BlogCategory, Prisma } from '@ecommerce/database';
import {
  readingMinutes,
  type BlogCategoryDto,
  type BlogPostDto,
  type BlogPostListItem,
  type PublicBlogCard,
  type PublicBlogPost,
} from '@ecommerce/types';
import { readPageContent } from './cms-rules';

export const postInclude = {
  category: true,
  author: { select: { firstName: true, lastName: true } },
} satisfies Prisma.BlogPostInclude;
export type PostRow = Prisma.BlogPostGetPayload<{ include: typeof postInclude }>;

const authorName = (p: PostRow) =>
  p.author ? `${p.author.firstName} ${p.author.lastName}`.trim() : null;
const categoryRef = (c: BlogCategory | null) =>
  c ? { id: c.id, name: c.name, slug: c.slug } : null;

export function toPostListItem(p: PostRow, now = new Date()): BlogPostListItem {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    isScheduled: p.status === 'PUBLISHED' && p.publishedAt !== null && p.publishedAt > now,
    category: categoryRef(p.category),
    authorName: authorName(p),
    coverImageUrl: p.coverImageUrl,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toPostDto(p: PostRow): BlogPostDto {
  return {
    ...toPostListItem(p),
    excerpt: p.excerpt,
    content: readPageContent(p.content),
    tags: p.tags,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
  };
}

export function toPublicCard(p: PostRow): PublicBlogCard {
  return {
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    coverImageUrl: p.coverImageUrl,
    category: categoryRef(p.category),
    tags: p.tags,
    authorName: authorName(p),
    publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
    readingMinutes: readingMinutes(readPageContent(p.content)),
  };
}

export function toPublicPost(p: PostRow, related: PostRow[]): PublicBlogPost {
  return {
    ...toPublicCard(p),
    content: readPageContent(p.content),
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    updatedAt: p.updatedAt.toISOString(),
    related: related.map(toPublicCard),
  };
}

export function toCategoryDto(c: BlogCategory, postCount: number): BlogCategoryDto {
  return { id: c.id, name: c.name, slug: c.slug, postCount };
}
