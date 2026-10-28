import { z } from 'zod';
import {
  BANNER_PLACEMENTS,
  LINK_REGEX,
  MAX_MENU_ITEMS,
  MAX_PAGE_BLOCKS,
  PAGE_BLOCK_TYPES,
  type BannerDto,
  type BannerInput,
  type FaqDto,
  type FaqInput,
  type MenuDto,
  type MenuInput,
  type PageBlock,
  type PageContent,
  type PageDto,
  type PageInput,
} from '../cms/cms';
import {
  emptyToNull,
  isoToLocalInput,
  localInputToIso,
  optionalSlugField,
  optionalUrlField,
} from './common';

const linkField = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(500)
  .regex(LINK_REGEX, 'Use a path like /pages/about or a full https:// URL');
const optionalLinkField = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || LINK_REGEX.test(v),
    'Use a path like /pages/about or a full https:// URL',
  );

// ================================================================ page content (API + forms)

/** Validates stored / submitted page content. The API uses this too, so both sides agree. */
export const pageContentSchema = z.object({
  blocks: z
    .array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('heading'),
          text: z.string().trim().min(1).max(200),
          level: z.union([z.literal(2), z.literal(3)]),
        }),
        z.object({ type: z.literal('paragraph'), text: z.string().trim().min(1).max(5000) }),
        z.object({
          type: z.literal('image'),
          url: z
            .string()
            .trim()
            .regex(/^https?:\/\/\S+$/),
          alt: z.string().trim().max(200),
          caption: z.string().trim().max(300).nullable(),
        }),
        z.object({
          type: z.literal('button'),
          label: z.string().trim().min(1).max(60),
          url: linkField,
        }),
      ]),
    )
    .max(MAX_PAGE_BLOCKS, `At most ${MAX_PAGE_BLOCKS} blocks`),
});

// ================================================================ page form

/** One editable row; which fields matter depends on `type`. Flat so useFieldArray stays simple. */
export const pageBlockRowSchema = z
  .object({
    type: z.enum(PAGE_BLOCK_TYPES),
    text: z.string(),
    level: z.enum(['2', '3']),
    url: z.string().trim(),
    alt: z.string().max(200, 'At most 200 characters'),
    caption: z.string().max(300, 'At most 300 characters'),
    label: z.string().max(60, 'At most 60 characters'),
  })
  .superRefine((row, ctx) => {
    const need = (path: 'text' | 'url' | 'label', message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if ((row.type === 'heading' || row.type === 'paragraph') && row.text.trim() === '')
      need('text', 'Enter the text');
    if (row.type === 'heading' && row.text.length > 200) need('text', 'At most 200 characters');
    if (row.type === 'paragraph' && row.text.length > 5000) need('text', 'At most 5000 characters');
    if (row.type === 'image' && !/^https?:\/\/\S+$/.test(row.url)) need('url', 'Upload an image');
    if (row.type === 'button') {
      if (row.label.trim() === '') need('label', 'Enter the button text');
      if (!LINK_REGEX.test(row.url))
        need('url', 'Use a path like /products or a full https:// URL');
    }
  });
export type PageBlockRow = z.infer<typeof pageBlockRowSchema>;

export const emptyBlockRow = (type: PageBlockRow['type'] = 'paragraph'): PageBlockRow => ({
  type,
  text: '',
  level: '2',
  url: '',
  alt: '',
  caption: '',
  label: '',
});

export const pageFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'At most 200 characters'),
  slug: optionalSlugField,
  status: z.enum(['DRAFT', 'PUBLISHED']),
  seoTitle: z.string().trim().max(70, 'At most 70 characters'),
  seoDescription: z.string().trim().max(160, 'At most 160 characters'),
  blocks: z.array(pageBlockRowSchema).max(MAX_PAGE_BLOCKS, `At most ${MAX_PAGE_BLOCKS} blocks`),
});
export type PageFormValues = z.infer<typeof pageFormSchema>;

export const emptyPageForm: PageFormValues = {
  title: '',
  slug: '',
  status: 'DRAFT',
  seoTitle: '',
  seoDescription: '',
  blocks: [emptyBlockRow('paragraph')],
};

export function blockToRow(b: PageBlock): PageBlockRow {
  const row = emptyBlockRow(b.type);
  switch (b.type) {
    case 'heading':
      return { ...row, text: b.text, level: b.level === 3 ? '3' : '2' };
    case 'paragraph':
      return { ...row, text: b.text };
    case 'image':
      return { ...row, url: b.url, alt: b.alt, caption: b.caption ?? '' };
    case 'button':
      return { ...row, label: b.label, url: b.url };
  }
}

export function rowToBlock(r: PageBlockRow): PageBlock {
  switch (r.type) {
    case 'heading':
      return { type: 'heading', text: r.text.trim(), level: r.level === '3' ? 3 : 2 };
    case 'paragraph':
      return { type: 'paragraph', text: r.text.trim() };
    case 'image':
      return {
        type: 'image',
        url: r.url.trim(),
        alt: r.alt.trim(),
        caption: emptyToNull(r.caption),
      };
    case 'button':
      return { type: 'button', label: r.label.trim(), url: r.url.trim() };
  }
}

export function pageToForm(p: PageDto): PageFormValues {
  return {
    title: p.title,
    slug: p.slug,
    status: p.status,
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    blocks: p.content.blocks.map(blockToRow),
  };
}

export function pageFormToInput(v: PageFormValues): PageInput {
  const content: PageContent = { blocks: v.blocks.map(rowToBlock) };
  return {
    title: v.title.trim(),
    slug: v.slug.trim() === '' ? undefined : v.slug.trim(),
    content,
    status: v.status,
    seoTitle: emptyToNull(v.seoTitle),
    seoDescription: emptyToNull(v.seoDescription),
  };
}

// ================================================================ banner form

export const bannerFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120, 'At most 120 characters'),
    imageUrl: z
      .string()
      .trim()
      .regex(/^https?:\/\/\S+$/, 'Upload the banner image'),
    mobileImageUrl: optionalUrlField,
    linkUrl: optionalLinkField,
    placement: z.enum(BANNER_PLACEMENTS),
    position: z.number({ invalid_type_error: 'Enter a number' }).int().min(0).max(999),
    startsAt: z.string(),
    endsAt: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'Must be after the start',
      });
    }
  });
export type BannerFormValues = z.infer<typeof bannerFormSchema>;

export const emptyBannerForm: BannerFormValues = {
  title: '',
  imageUrl: '',
  mobileImageUrl: '',
  linkUrl: '',
  placement: 'home.hero',
  position: 0,
  startsAt: '',
  endsAt: '',
  isActive: true,
};

export function bannerToForm(b: BannerDto): BannerFormValues {
  return {
    title: b.title,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl ?? '',
    linkUrl: b.linkUrl ?? '',
    placement: b.placement,
    position: b.position,
    startsAt: isoToLocalInput(b.startsAt),
    endsAt: isoToLocalInput(b.endsAt),
    isActive: b.isActive,
  };
}

export function bannerFormToInput(v: BannerFormValues): BannerInput {
  return {
    title: v.title.trim(),
    imageUrl: v.imageUrl.trim(),
    mobileImageUrl: emptyToNull(v.mobileImageUrl),
    linkUrl: emptyToNull(v.linkUrl),
    placement: v.placement,
    position: v.position,
    startsAt: localInputToIso(v.startsAt),
    endsAt: localInputToIso(v.endsAt),
    isActive: v.isActive,
  };
}

// ================================================================ menu form

const menuLinkRow = z.object({
  label: z.string().trim().min(1, 'Enter a label').max(60, 'At most 60 characters'),
  url: linkField,
});

export const menuFormSchema = z.object({
  items: z
    .array(
      menuLinkRow.extend({
        children: z.array(menuLinkRow).max(MAX_MENU_ITEMS, `At most ${MAX_MENU_ITEMS} links`),
      }),
    )
    .max(MAX_MENU_ITEMS, `At most ${MAX_MENU_ITEMS} items`),
});
export type MenuFormValues = z.infer<typeof menuFormSchema>;

export const emptyMenuLink = () => ({ label: '', url: '' });
export const emptyMenuItem = () => ({
  label: '',
  url: '',
  children: [] as { label: string; url: string }[],
});

export function menuToForm(m: MenuDto): MenuFormValues {
  return {
    items: m.items.map((i) => ({
      label: i.label,
      url: i.url,
      children: i.children.map((c) => ({ label: c.label, url: c.url })),
    })),
  };
}

export function menuFormToInput(v: MenuFormValues): MenuInput {
  return {
    items: v.items.map((i) => ({
      label: i.label.trim(),
      url: i.url.trim(),
      children: i.children.map((c) => ({ label: c.label.trim(), url: c.url.trim() })),
    })),
  };
}

// ================================================================ FAQ form

export const faqFormSchema = z.object({
  question: z.string().trim().min(5, 'At least 5 characters').max(300, 'At most 300 characters'),
  answer: z.string().trim().min(5, 'At least 5 characters').max(5000, 'At most 5000 characters'),
  category: z.string().trim().max(60, 'At most 60 characters'),
  position: z.number({ invalid_type_error: 'Enter a number' }).int().min(0).max(999),
  isActive: z.boolean(),
});
export type FaqFormValues = z.infer<typeof faqFormSchema>;

export const emptyFaqForm: FaqFormValues = {
  question: '',
  answer: '',
  category: '',
  position: 0,
  isActive: true,
};

export function faqToForm(f: FaqDto): FaqFormValues {
  return {
    question: f.question,
    answer: f.answer,
    category: f.category ?? '',
    position: f.position,
    isActive: f.isActive,
  };
}

export function faqFormToInput(v: FaqFormValues): FaqInput {
  return {
    question: v.question.trim(),
    answer: v.answer.trim(),
    category: emptyToNull(v.category),
    position: v.position,
    isActive: v.isActive,
  };
}
