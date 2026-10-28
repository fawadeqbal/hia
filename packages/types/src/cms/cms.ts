export type PublishState = 'DRAFT' | 'PUBLISHED';

/** Internal path ("/pages/about") or absolute http(s) URL. Used by menus, banners and page buttons. */
export const LINK_REGEX = /^(\/(?!\/)\S*|https?:\/\/\S+)$/;

// ---------------------------------------------------------------- pages

export const PAGE_BLOCK_TYPES = ['heading', 'paragraph', 'image', 'button'] as const;
export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

export const PAGE_BLOCK_LABELS: Record<PageBlockType, string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  image: 'Image',
  button: 'Button link',
};

/** Page content is a list of safe, typed blocks (no raw HTML, so nothing to sanitise). */
export type PageBlock =
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; url: string; alt: string; caption: string | null }
  | { type: 'button'; label: string; url: string };

export interface PageContent {
  blocks: PageBlock[];
}

export const MAX_PAGE_BLOCKS = 100;

export interface PageListItem {
  id: string;
  title: string;
  slug: string;
  locale: string;
  status: PublishState;
  publishedAt: string | null;
  updatedAt: string;
}

export interface PageDto extends PageListItem {
  content: PageContent;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface PageInput {
  title: string;
  /** Generated from the title when omitted. */
  slug?: string;
  locale?: string;
  content: PageContent;
  status: PublishState;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

/** Published page for the storefront. */
export interface PublicPageDto {
  title: string;
  slug: string;
  content: PageContent;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------- banners

export const BANNER_PLACEMENTS = ['home.hero', 'home.mid', 'category.top'] as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];

export const BANNER_PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  'home.hero': 'Home: hero (top)',
  'home.mid': 'Home: middle strip',
  'category.top': 'Category pages: top',
};

export interface BannerDto {
  id: string;
  title: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  placement: BannerPlacement;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  /** Active and inside its schedule right now. */
  isLive: boolean;
  createdAt: string;
}

export interface BannerInput {
  title: string;
  imageUrl: string;
  mobileImageUrl?: string | null;
  linkUrl?: string | null;
  placement: BannerPlacement;
  position?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export interface PublicBannerDto {
  id: string;
  title: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
}

// ---------------------------------------------------------------- menus

export const MENU_HANDLES = ['header', 'footer'] as const;
export type MenuHandle = (typeof MENU_HANDLES)[number];

export const MENU_LABELS: Record<MenuHandle, { name: string; hint: string }> = {
  header: { name: 'Header menu', hint: 'Links in the top navigation bar. Sub-links are ignored.' },
  footer: {
    name: 'Footer menu',
    hint: 'Each top-level item is a column title; its sub-links are the column links.',
  },
};

export const MAX_MENU_ITEMS = 30;

export interface MenuItemDto {
  id: string;
  label: string;
  url: string;
  position: number;
  children: MenuItemDto[];
}

export interface MenuDto {
  id: string;
  name: string;
  handle: MenuHandle;
  items: MenuItemDto[];
}

/** Two levels: items with optional children. Order in the array = display order. */
export interface MenuItemInput {
  label: string;
  url: string;
  children?: { label: string; url: string }[];
}

export interface MenuInput {
  items: MenuItemInput[];
}

/** Storefront shape (no ids needed). */
export interface PublicMenuItem {
  label: string;
  url: string;
  children: { label: string; url: string }[];
}

// ---------------------------------------------------------------- FAQs

export interface FaqDto {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  position: number;
  isActive: boolean;
}

export interface FaqInput {
  question: string;
  answer: string;
  category?: string | null;
  position?: number;
  isActive?: boolean;
}

export interface PublicFaqGroup {
  category: string;
  items: { id: string; question: string; answer: string }[];
}

export const FAQ_DEFAULT_CATEGORY = 'General';
