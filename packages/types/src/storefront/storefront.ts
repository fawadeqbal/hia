/** Public product data for the storefront (only published products of approved vendors). */

export const STOREFRONT_SORTS = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'popular',
  'rating',
] as const;
export type StorefrontSort = (typeof STOREFRONT_SORTS)[number];

export const STOREFRONT_SORT_LABELS: Record<StorefrontSort, string> = {
  relevance: 'Best match',
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  popular: 'Best selling',
  rating: 'Top rated',
};

export interface StorefrontProductQuery {
  q?: string;
  category?: string;
  brand?: string;
  vendor?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: StorefrontSort;
  featured?: boolean;
  /** Minimum average rating, 1–5. */
  minRating?: number;
  /** Only products with sellable stock. */
  inStock?: boolean;
  /** Only discounted products. */
  onSale?: boolean;
  /** Comma-separated attribute value ids (OR within an attribute, AND across attributes). */
  values?: string;
  page?: number;
  limit?: number;
}

export interface StorefrontProductCard {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  /** Second product photo, shown when the card is hovered (null when there is only one). */
  hoverImageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  brandName: string | null;
  vendor: { name: string; slug: string };
  ratingAverage: number;
  ratingCount: number;
  inStock: boolean;
  /** True when the product has options (shows "from" price). */
  hasOptions: boolean;
}

export interface StorefrontVariant {
  id: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  isDefault: boolean;
  /** Units that can be bought right now (on hand − reserved, active warehouses). */
  available: number;
  /** attributeId -> valueId */
  values: Record<string, string>;
  label: string | null;
}

export interface StorefrontOption {
  attributeId: string;
  name: string;
  type: string;
  values: { id: string; label: string; swatch: string | null }[];
}

export interface StorefrontProductDetail {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  specifications: { label: string; value: string }[];
  images: { url: string; altText: string | null }[];
  currency: string;
  price: number;
  compareAtPrice: number | null;
  ratingAverage: number;
  ratingCount: number;
  category: { name: string; slug: string };
  brand: { name: string; slug: string } | null;
  vendor: { name: string; slug: string; logoUrl: string | null };
  options: StorefrontOption[];
  variants: StorefrontVariant[];
  defaultVariantId: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

/** Finds the variant matching the selected option values (null when the combination doesn't exist). */
export function findVariant(
  variants: StorefrontVariant[],
  options: StorefrontOption[],
  selected: Record<string, string>,
): StorefrontVariant | null {
  if (options.length === 0) return variants.find((v) => v.isDefault) ?? variants[0] ?? null;
  return (
    variants.find((v) =>
      options.every((o) => v.values[o.attributeId] === selected[o.attributeId]),
    ) ?? null
  );
}

// ---------------------------------------------------------------- discovery (Step 21)

export interface SearchSuggestions {
  products: {
    name: string;
    slug: string;
    imageUrl: string | null;
    price: number;
    currency: string;
  }[];
  categories: { name: string; slug: string }[];
  brands: { name: string; slug: string }[];
}

export interface DidYouMean {
  suggestion: string | null;
}

export interface PublicBrandPage {
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  productCount: number;
}

export interface PublicStorePage {
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  ratingAverage: number;
  reviewCount: number;
  productCount: number;
  joinedAt: string;
  policies: { shipping: string | null; returns: string | null };
}

export interface ProductRecommendations {
  related: StorefrontProductCard[];
  boughtTogether: StorefrontProductCard[];
}

export const RECENTLY_VIEWED_KEY = 'recently-viewed';
export const RECENTLY_VIEWED_MAX = 12;

/** Most recent first, unique, capped. Pure so the storefront and tests share it. */
export function pushRecentlyViewed(
  list: string[],
  slug: string,
  max = RECENTLY_VIEWED_MAX,
): string[] {
  return [slug, ...list.filter((s) => s !== slug)].slice(0, max);
}
