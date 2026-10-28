import { ProductStatus } from '../enums';

export const PRODUCT_STATUSES = Object.values(ProductStatus) as ProductStatus[];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'In review',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
};

export const MAX_PRODUCT_IMAGES = 10;
export const SKU_REGEX = /^[A-Za-z0-9._-]+$/;

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductImageDto {
  id: string;
  url: string;
  altText: string | null;
  position: number;
}

export const MAX_VARIANTS = 100;

export interface ProductVariantOption {
  attributeId: string;
  attributeName: string;
  attributeCode: string;
  valueId: string;
  valueLabel: string;
  swatch: string | null;
}

export interface ProductVariantDto {
  id: string;
  sku: string;
  /** "Black / 256GB" (empty for simple products). */
  name: string | null;
  price: number;
  compareAtPrice: number | null;
  isDefault: boolean;
  isActive: boolean;
  position: number;
  options: ProductVariantOption[];
  /** Variants that were ordered cannot be deleted, only deactivated. */
  orderCount: number;
}

/** An attribute used by a product's variants, with the values in use. */
export interface ProductOptionDto {
  attributeId: string;
  name: string;
  code: string;
  type: string;
  values: { id: string; label: string; swatch: string | null }[];
}

export interface ProductVariantInput {
  /** Existing variant id; omit for a new variant. */
  id?: string;
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  isActive: boolean;
  /** One attribute value per attribute (e.g. [black, 256gb]). Empty = simple product. */
  valueIds: string[];
}

/** PUT /vendor/products/:id/variants — the full desired variant list. */
export interface ProductVariantsInput {
  variants: ProductVariantInput[];
}

export interface ProductRejectInput {
  reason: string;
}

export interface ProductFeatureInput {
  isFeatured: boolean;
}

export const PRODUCT_REASON_MIN = 10;

/** Stable key for a combination of attribute values. */
export const variantComboKey = (valueIds: string[]) => [...valueIds].sort().join('|');

/** Cartesian product: [[a,b],[x,y]] -> [[a,x],[a,y],[b,x],[b,y]]. */
export function cartesian<T>(groups: T[][]): T[][] {
  return groups.reduce<T[][]>(
    (acc, group) => acc.flatMap((combo) => group.map((item) => [...combo, item])),
    [[]],
  );
}

/** "SAM-S24" + ["Black", "256GB"] -> "SAM-S24-BLACK-256GB" */
export function suggestVariantSku(baseSku: string, labels: string[]): string {
  const part = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return [baseSku, ...labels.map(part)].filter(Boolean).join('-').slice(0, 64);
}

export interface ProductRef {
  id: string;
  name: string;
  slug: string;
}

/** Full product (vendor edit screen, admin detail). Money as numbers in `currency`. */
export interface ProductDto {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  shortDescription: string | null;
  description: string | null;
  specifications: ProductSpec[];
  basePrice: number;
  compareAtPrice: number | null;
  currency: string;
  /** SKU of the default variant. */
  sku: string;
  weightGrams: number | null;
  /** TaxClass; null = standard. */
  taxClass: string | null;
  videoUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isFeatured: boolean;
  /** Why an admin rejected / unpublished the product. */
  rejectionReason: string | null;
  /** True when the product has variants with options (price & SKU are managed per variant). */
  hasOptions: boolean;
  variants: ProductVariantDto[];
  options: ProductOptionDto[];
  category: ProductRef;
  brand: ProductRef | null;
  vendor: ProductRef;
  images: ProductImageDto[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  sku: string;
  basePrice: number;
  compareAtPrice: number | null;
  currency: string;
  imageUrl: string | null;
  categoryName: string;
  brandName: string | null;
  vendor: ProductRef;
  updatedAt: string;
}

export interface ProductImageInput {
  url: string;
  altText?: string | null;
}

/** Body for POST /vendor/products and PATCH /vendor/products/:id. */
export interface ProductInput {
  name: string;
  slug?: string;
  categoryId: string;
  brandId?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  specifications?: ProductSpec[];
  basePrice: number;
  compareAtPrice?: number | null;
  sku: string;
  weightGrams?: number | null;
  taxClass?: string | null;
  videoUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  /** Ordered; the first image is the main image. Replaces the whole gallery on update. */
  images?: ProductImageInput[];
}

export interface ProductListQuery {
  status?: ProductStatus;
  search?: string;
  categoryId?: string;
  vendorId?: string;
  page?: number;
  limit?: number;
}

/** What a product needs before it can be submitted for review (shown in the vendor form). */
export function productSubmitProblems(
  p: Pick<ProductDto, 'images' | 'description' | 'basePrice'>,
): string[] {
  const problems: string[] = [];
  if (p.images.length === 0) problems.push('Add at least one image');
  if (!p.description || p.description.trim().length < 20)
    problems.push('Write a description (20+ characters)');
  if (!(p.basePrice > 0)) problems.push('Set a price greater than 0');
  if (
    'variants' in p &&
    Array.isArray((p as ProductDto).variants) &&
    !(p as ProductDto).variants.some((v) => v.isActive)
  ) {
    problems.push('Activate at least one variant');
  }
  return problems;
}
