import type { Prisma } from '@ecommerce/database';
import type {
  ProductDto,
  ProductListItem,
  ProductOptionDto,
  ProductSpec,
  ProductStatus,
  ProductVariantDto,
} from '@ecommerce/types';

const ref = { select: { id: true, name: true, slug: true } } as const;

export const productDetailInclude = {
  category: ref,
  brand: ref,
  vendor: ref,
  images: { orderBy: { position: 'asc' } },
  variants: {
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
    include: {
      attributes: { include: { attributeValue: { include: { attribute: true } } } },
      _count: { select: { orderItems: true } },
    },
  },
} satisfies Prisma.ProductInclude;

export const productListInclude = {
  category: { select: { name: true } },
  brand: { select: { name: true } },
  vendor: ref,
  images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
  variants: { where: { isDefault: true }, take: 1, select: { sku: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithDetail = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;
export type ProductWithList = Prisma.ProductGetPayload<{ include: typeof productListInclude }>;
type VariantRow = ProductWithDetail['variants'][number];

const money = (v: Prisma.Decimal | null): number | null => (v === null ? null : Number(v));

/** Variant options sorted by attribute position so labels read consistently ("Black / 256GB"). */
function variantOptions(v: VariantRow) {
  return [...v.attributes]
    .sort(
      (a, b) =>
        a.attributeValue.attribute.position - b.attributeValue.attribute.position ||
        a.attributeValue.attribute.name.localeCompare(b.attributeValue.attribute.name),
    )
    .map(({ attributeValue: val }) => ({
      attributeId: val.attributeId,
      attributeName: val.attribute.name,
      attributeCode: val.attribute.code,
      valueId: val.id,
      valueLabel: val.label ?? val.value,
      swatch: val.swatch,
    }));
}

export function toVariantDto(v: VariantRow): ProductVariantDto {
  return {
    id: v.id,
    sku: v.sku,
    name: v.name,
    price: Number(v.price),
    compareAtPrice: money(v.compareAtPrice),
    isDefault: v.isDefault,
    isActive: v.isActive,
    position: v.position,
    options: variantOptions(v),
    orderCount: v._count.orderItems,
  };
}

/** Attributes used across the product's variants, with the distinct values in use. */
function productOptions(variants: VariantRow[]): ProductOptionDto[] {
  const byAttribute = new Map<string, ProductOptionDto & { position: number }>();
  for (const v of variants) {
    for (const { attributeValue: val } of v.attributes) {
      const option =
        byAttribute.get(val.attributeId) ??
        ({
          attributeId: val.attributeId,
          name: val.attribute.name,
          code: val.attribute.code,
          type: val.attribute.type,
          values: [],
          position: val.attribute.position,
        } as ProductOptionDto & { position: number });
      if (!option.values.some((x) => x.id === val.id)) {
        option.values.push({ id: val.id, label: val.label ?? val.value, swatch: val.swatch });
      }
      byAttribute.set(val.attributeId, option);
    }
  }
  return [...byAttribute.values()]
    .sort((a, b) => a.position - b.position)
    .map(({ position: _position, ...option }) => option);
}

export function toProductDto(p: ProductWithDetail): ProductDto {
  const defaultVariant = p.variants.find((v) => v.isDefault) ?? p.variants[0];
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status as ProductStatus,
    shortDescription: p.shortDescription,
    description: p.description,
    specifications: Array.isArray(p.specifications)
      ? (p.specifications as unknown as ProductSpec[])
      : [],
    basePrice: Number(p.basePrice),
    compareAtPrice: money(p.compareAtPrice),
    currency: p.currency,
    sku: defaultVariant?.sku ?? '',
    weightGrams: p.weightGrams,
    taxClass: p.taxClass,
    videoUrl: p.videoUrl,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    isFeatured: p.isFeatured,
    rejectionReason: p.rejectionReason,
    hasOptions: p.variants.some((v) => v.attributes.length > 0),
    variants: p.variants.map(toVariantDto),
    options: productOptions(p.variants),
    category: p.category,
    brand: p.brand,
    vendor: p.vendor,
    images: p.images.map((i) => ({
      id: i.id,
      url: i.url,
      altText: i.altText,
      position: i.position,
    })),
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toProductListItem(p: ProductWithList): ProductListItem {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status as ProductStatus,
    sku: p.variants[0]?.sku ?? '',
    basePrice: Number(p.basePrice),
    compareAtPrice: money(p.compareAtPrice),
    currency: p.currency,
    imageUrl: p.images[0]?.url ?? null,
    categoryName: p.category.name,
    brandName: p.brand?.name ?? null,
    vendor: p.vendor,
    updatedAt: p.updatedAt.toISOString(),
  };
}
