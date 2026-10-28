import { z } from 'zod';
import type { BlogCategoryDto, BlogCategoryInput, BlogPostDto, BlogPostInput } from '../cms/blog';
import { parseTags } from '../cms/blog';
import { MAX_PAGE_BLOCKS } from '../cms/cms';
import { blockToRow, pageBlockRowSchema, rowToBlock, type PageBlockRow } from './cms.schema';
import { emptyToNull, isoToLocalInput, optionalSlugField, optionalUrlField } from './common';

export const blogPostFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'At most 200 characters'),
  slug: optionalSlugField,
  excerpt: z.string().trim().max(300, 'At most 300 characters'),
  categoryId: z.string(),
  tags: z.string().max(400, 'Too many tags'),
  coverImageUrl: optionalUrlField,
  status: z.enum(['DRAFT', 'PUBLISHED']),
  publishedAt: z.string(),
  seoTitle: z.string().trim().max(70, 'At most 70 characters'),
  seoDescription: z.string().trim().max(160, 'At most 160 characters'),
  blocks: z.array(pageBlockRowSchema).max(MAX_PAGE_BLOCKS, `At most ${MAX_PAGE_BLOCKS} blocks`),
});
export type BlogPostFormValues = z.infer<typeof blogPostFormSchema>;

const firstRow: PageBlockRow = {
  type: 'paragraph',
  text: '',
  level: '2',
  url: '',
  alt: '',
  caption: '',
  label: '',
};

export const emptyBlogPostForm: BlogPostFormValues = {
  title: '',
  slug: '',
  excerpt: '',
  categoryId: '',
  tags: '',
  coverImageUrl: '',
  status: 'DRAFT',
  publishedAt: '',
  seoTitle: '',
  seoDescription: '',
  blocks: [firstRow],
};

export function blogPostToForm(p: BlogPostDto): BlogPostFormValues {
  return {
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? '',
    categoryId: p.category?.id ?? '',
    tags: p.tags.join(', '),
    coverImageUrl: p.coverImageUrl ?? '',
    status: p.status,
    publishedAt: isoToLocalInput(p.publishedAt),
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    blocks: p.content.blocks.map(blockToRow),
  };
}

export function blogPostFormToInput(v: BlogPostFormValues): BlogPostInput {
  return {
    title: v.title.trim(),
    slug: v.slug.trim() === '' ? undefined : v.slug.trim(),
    excerpt: emptyToNull(v.excerpt),
    content: { blocks: v.blocks.map(rowToBlock) },
    categoryId: v.categoryId || null,
    tags: parseTags(v.tags),
    coverImageUrl: emptyToNull(v.coverImageUrl),
    status: v.status,
    publishedAt: v.publishedAt.trim() === '' ? null : new Date(v.publishedAt).toISOString(),
    seoTitle: emptyToNull(v.seoTitle),
    seoDescription: emptyToNull(v.seoDescription),
  };
}

export const blogCategoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'At most 60 characters'),
  slug: optionalSlugField,
});
export type BlogCategoryFormValues = z.infer<typeof blogCategoryFormSchema>;
export const emptyBlogCategoryForm: BlogCategoryFormValues = { name: '', slug: '' };
export const blogCategoryToForm = (c: BlogCategoryDto): BlogCategoryFormValues => ({
  name: c.name,
  slug: c.slug,
});
export const blogCategoryFormToInput = (v: BlogCategoryFormValues): BlogCategoryInput => ({
  name: v.name.trim(),
  slug: v.slug.trim() === '' ? undefined : v.slug.trim(),
});
