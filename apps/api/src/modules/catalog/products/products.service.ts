import { ownedOrStaffed } from '../../../common/utils/vendor-scope';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, Vendor } from '@ecommerce/database';
import {
  EmailTemplateKey,
  PRODUCT_STATUS_LABELS,
  productSubmitProblems,
  variantComboKey,
  type EmailJobPayload,
  type Paginated,
  type ProductDto,
  type ProductListItem,
  type ProductStatus,
} from '@ecommerce/types';
import { paginate } from '../../../common/dto/pagination.dto';
import { uniqueSlug } from '../../../common/utils/unique-slug';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import type {
  CreateProductDto,
  ManageProductQueryDto,
  ProductVariantInputDto,
  UpdateProductDto,
} from './dto/product.dto';
import {
  productDetailInclude,
  productListInclude,
  toProductDto,
  toProductListItem,
  type ProductWithDetail,
} from './product.mapper';

const APPROVAL_SETTING = 'marketplace.productApprovalRequired';

/** Plain filter shape for list(); a DTO spread loses its class getters, so don't type this as the DTO. */
type ProductListParams = Pick<
  ManageProductQueryDto,
  'page' | 'limit' | 'status' | 'search' | 'categoryId' | 'vendorId'
>;

/**
 * Products.
 * Seller lifecycle: DRAFT → submit → PENDING_REVIEW (or PUBLISHED when approval is off)
 *                   any → ARCHIVED → restore → DRAFT;  delete = soft delete.
 * Admin moderation: PENDING_REVIEW → approve → PUBLISHED;  PENDING_REVIEW | PUBLISHED → reject → REJECTED (reason).
 * Variants: a simple product has one default variant without options; an option product has 1..100
 *           variants, each a unique combination of one value per attribute. basePrice = cheapest active variant.
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ================================================================ seller

  async vendorList(
    userId: string,
    query: ManageProductQueryDto,
  ): Promise<Paginated<ProductListItem>> {
    const vendor = await this.vendorOf(userId);
    return this.list({ ...query, vendorId: vendor.id });
  }

  async vendorGet(userId: string, id: string): Promise<ProductDto> {
    const vendor = await this.vendorOf(userId);
    return toProductDto(await this.findOwned(vendor.id, id));
  }

  async create(userId: string, dto: CreateProductDto): Promise<ProductDto> {
    const vendor = await this.vendorOf(userId, { requireApproved: true });
    await this.assertRefs(dto.categoryId, dto.brandId);
    assertPrices(dto.basePrice, dto.compareAtPrice);
    await this.assertSkusFree([dto.sku]);

    const currency =
      (await this.prisma.currency.findFirst({ where: { isDefault: true } }))?.code ?? 'USD';
    const created = await this.prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: dto.categoryId,
        brandId: dto.brandId || null,
        name: dto.name,
        slug: await this.resolveSlug(dto.slug, dto.name),
        shortDescription: dto.shortDescription ?? null,
        description: dto.description ?? null,
        specifications: (dto.specifications ?? []) as unknown as Prisma.InputJsonValue,
        basePrice: dto.basePrice,
        compareAtPrice: dto.compareAtPrice ?? null,
        currency,
        weightGrams: dto.weightGrams ?? null,
        taxClass: dto.taxClass ?? null,
        videoUrl: dto.videoUrl ?? null,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        status: 'DRAFT',
        variants: {
          create: {
            sku: dto.sku,
            price: dto.basePrice,
            compareAtPrice: dto.compareAtPrice ?? null,
            weightGrams: dto.weightGrams ?? null,
            isDefault: true,
          },
        },
        images: {
          create: (dto.images ?? []).map((img, position) => ({
            url: img.url,
            altText: img.altText ?? null,
            position,
          })),
        },
      },
      include: productDetailInclude,
    });

    await this.audit.log({
      actorId: userId,
      action: 'catalog.product.create',
      entityType: 'Product',
      entityId: created.id,
      after: created,
    });
    return toProductDto(created);
  }

  async update(userId: string, id: string, dto: UpdateProductDto): Promise<ProductDto> {
    const vendor = await this.vendorOf(userId, { requireApproved: true });
    const existing = await this.findOwned(vendor.id, id);
    const hasOptions = existing.variants.some((v) => v.attributes.length > 0);

    if (dto.categoryId !== undefined || dto.brandId !== undefined) {
      await this.assertRefs(dto.categoryId ?? existing.category.id, dto.brandId);
    }

    // Option products: price & SKU live on the variants (PUT /variants); ignore them here.
    const priceFields = hasOptions
      ? {}
      : { basePrice: dto.basePrice, compareAtPrice: dto.compareAtPrice };
    if (!hasOptions) {
      const basePrice = dto.basePrice ?? Number(existing.basePrice);
      const compareAtPrice =
        dto.compareAtPrice === undefined
          ? existing.compareAtPrice === null
            ? null
            : Number(existing.compareAtPrice)
          : dto.compareAtPrice;
      assertPrices(basePrice, compareAtPrice);
    }

    const defaultVariant = existing.variants.find((v) => v.isDefault) ?? existing.variants[0];
    if (!hasOptions && dto.sku !== undefined && dto.sku !== defaultVariant?.sku) {
      await this.assertSkusFree(
        [dto.sku],
        [defaultVariant?.id].filter((x): x is string => Boolean(x)),
      );
    }

    const slug =
      dto.slug !== undefined && dto.slug !== existing.slug
        ? await this.resolveSlug(dto.slug, dto.name ?? existing.name, id)
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          slug,
          categoryId: dto.categoryId,
          brandId: dto.brandId === undefined ? undefined : dto.brandId || null,
          shortDescription: dto.shortDescription,
          description: dto.description,
          specifications:
            dto.specifications === undefined
              ? undefined
              : (dto.specifications as unknown as Prisma.InputJsonValue),
          ...priceFields,
          weightGrams: dto.weightGrams,
          taxClass: dto.taxClass,
          videoUrl: dto.videoUrl,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
        },
      });

      if (!hasOptions) {
        const variantData = {
          sku: dto.sku,
          price: dto.basePrice,
          compareAtPrice: dto.compareAtPrice,
          weightGrams: dto.weightGrams,
        };
        if (defaultVariant) {
          await tx.productVariant.update({ where: { id: defaultVariant.id }, data: variantData });
        } else {
          await tx.productVariant.create({
            data: {
              productId: id,
              sku: dto.sku ?? `${existing.slug}-default`,
              price: dto.basePrice ?? Number(existing.basePrice),
              isDefault: true,
            },
          });
        }
      }

      if (dto.images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id, variantId: null } });
        if (dto.images.length > 0) {
          await tx.productImage.createMany({
            data: dto.images.map((img, position) => ({
              productId: id,
              url: img.url,
              altText: img.altText ?? null,
              position,
            })),
          });
        }
      }
    });

    const updated = await this.findOwned(vendor.id, id);
    await this.audit.log({
      actorId: userId,
      action: 'catalog.product.update',
      entityType: 'Product',
      entityId: id,
      before: existing,
      after: updated,
    });
    return toProductDto(updated);
  }

  /**
   * Replaces the product's variants with the given list.
   * Variants that have been ordered are deactivated instead of deleted.
   */
  async saveVariants(
    userId: string,
    id: string,
    variants: ProductVariantInputDto[],
  ): Promise<ProductDto> {
    const vendor = await this.vendorOf(userId, { requireApproved: true });
    const existing = await this.findOwned(vendor.id, id);

    const existingById = new Map(existing.variants.map((v) => [v.id, v]));
    for (const v of variants) {
      if (v.id && !existingById.has(v.id))
        throw new BadRequestException(`Variant ${v.id} does not belong to this product`);
      assertPrices(v.price, v.compareAtPrice);
    }
    if (!variants.some((v) => v.isActive))
      throw new BadRequestException('At least one variant must be active');

    const labels = await this.validateCombinations(variants);

    const keptIds = variants.map((v) => v.id).filter((x): x is string => Boolean(x));
    const removed = existing.variants.filter((v) => !keptIds.includes(v.id));
    const deletable = removed.filter((v) => v._count.orderItems === 0);
    const retired = removed.filter((v) => v._count.orderItems > 0);
    await this.assertSkusFree(
      variants.map((v) => v.sku),
      [...keptIds, ...deletable.map((v) => v.id)],
    );

    const firstActive = variants.findIndex((v) => v.isActive);
    const cheapest = variants
      .filter((v) => v.isActive)
      .reduce((min, v) => (v.price < min.price ? v : min));

    await this.prisma.$transaction(async (tx) => {
      if (deletable.length > 0) {
        await tx.productVariant.deleteMany({ where: { id: { in: deletable.map((v) => v.id) } } });
      }
      if (retired.length > 0) {
        await tx.productVariant.updateMany({
          where: { id: { in: retired.map((v) => v.id) } },
          data: { isActive: false, isDefault: false },
        });
      }
      // Move kept SKUs out of the way so swaps never hit the unique constraint.
      for (const keptId of keptIds) {
        await tx.productVariant.update({
          where: { id: keptId },
          data: { sku: `__tmp__${keptId}` },
        });
      }

      for (const [index, v] of variants.entries()) {
        const data = {
          sku: v.sku,
          name: labels[index] || null,
          price: v.price,
          compareAtPrice: v.compareAtPrice ?? null,
          isActive: v.isActive,
          isDefault: index === firstActive,
          position: index,
        };
        const variantId = v.id
          ? (await tx.productVariant.update({ where: { id: v.id }, data })).id
          : (await tx.productVariant.create({ data: { ...data, productId: id } })).id;

        await tx.productVariantAttribute.deleteMany({ where: { variantId } });
        if (v.valueIds.length > 0) {
          await tx.productVariantAttribute.createMany({
            data: v.valueIds.map((attributeValueId) => ({ variantId, attributeValueId })),
          });
        }
      }

      await tx.product.update({
        where: { id },
        data: { basePrice: cheapest.price, compareAtPrice: cheapest.compareAtPrice ?? null },
      });
    });

    const updated = await this.findOwned(vendor.id, id);
    await this.audit.log({
      actorId: userId,
      action: 'catalog.product.variants.save',
      entityType: 'Product',
      entityId: id,
      before: existing.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        price: v.price,
        isActive: v.isActive,
      })),
      after: updated.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        price: v.price,
        isActive: v.isActive,
      })),
    });
    return toProductDto(updated);
  }

  /** DRAFT / REJECTED → PENDING_REVIEW (or straight to PUBLISHED when approval is turned off). */
  async submit(userId: string, id: string): Promise<ProductDto> {
    const vendor = await this.vendorOf(userId, { requireApproved: true });
    const product = await this.findOwned(vendor.id, id);
    const problems = productSubmitProblems(toProductDto(product));
    if (problems.length > 0)
      throw new BadRequestException(`Not ready to submit: ${problems.join('; ')}`);

    const target: ProductStatus = (await this.approvalRequired()) ? 'PENDING_REVIEW' : 'PUBLISHED';
    return this.transition(
      userId,
      product,
      ['DRAFT', 'REJECTED'],
      target,
      'catalog.product.submit',
      { rejectionReason: null },
    );
  }

  async archive(userId: string, id: string): Promise<ProductDto> {
    const vendor = await this.vendorOf(userId);
    const product = await this.findOwned(vendor.id, id);
    return this.transition(
      userId,
      product,
      ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'],
      'ARCHIVED',
      'catalog.product.archive',
    );
  }

  async restore(userId: string, id: string): Promise<ProductDto> {
    const vendor = await this.vendorOf(userId, { requireApproved: true });
    const product = await this.findOwned(vendor.id, id);
    return this.transition(userId, product, ['ARCHIVED'], 'DRAFT', 'catalog.product.restore');
  }

  /** Soft delete: keeps order history intact. */
  async remove(userId: string, id: string): Promise<void> {
    const vendor = await this.vendorOf(userId);
    const product = await this.findOwned(vendor.id, id);
    if (product.status === 'PUBLISHED') {
      throw new ConflictException('Archive the product before deleting it.');
    }
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      actorId: userId,
      action: 'catalog.product.delete',
      entityType: 'Product',
      entityId: id,
    });
  }

  // ================================================================ admin

  adminList(query: ManageProductQueryDto): Promise<Paginated<ProductListItem>> {
    return this.list(query);
  }

  async adminGet(id: string): Promise<ProductDto> {
    return toProductDto(await this.findAny(id));
  }

  async approve(id: string, actorId?: string): Promise<ProductDto> {
    const product = await this.findAny(id);
    const result = await this.transition(
      actorId,
      product,
      ['PENDING_REVIEW'],
      'PUBLISHED',
      'catalog.product.approve',
      {
        rejectionReason: null,
      },
    );
    await this.emailVendor(product, EmailTemplateKey.VENDOR_PRODUCT_APPROVED, {
      heading: 'Your product is live',
      body: `"${product.name}" was approved and is now visible to customers.`,
    });
    return result;
  }

  /** Rejects a product in review, or takes down a published one. */
  async reject(id: string, reason: string, actorId?: string): Promise<ProductDto> {
    const product = await this.findAny(id);
    const wasPublished = product.status === 'PUBLISHED';
    const result = await this.transition(
      actorId,
      product,
      ['PENDING_REVIEW', 'PUBLISHED'],
      'REJECTED',
      'catalog.product.reject',
      {
        rejectionReason: reason,
        isFeatured: false,
      },
    );
    await this.emailVendor(product, EmailTemplateKey.VENDOR_PRODUCT_REJECTED, {
      heading: wasPublished ? 'Your product was unpublished' : 'Your product needs changes',
      body: `"${product.name}" ${wasPublished ? 'was removed from the store' : 'was not approved'}.\nReason: ${reason}\nUpdate it and submit it again.`,
    });
    return result;
  }

  async setFeatured(id: string, isFeatured: boolean, actorId?: string): Promise<ProductDto> {
    const product = await this.findAny(id);
    if (isFeatured && product.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published products can be featured');
    }
    const updated = await this.prisma.product.update({
      where: { id },
      data: { isFeatured },
      include: productDetailInclude,
    });
    await this.audit.log({
      actorId,
      action: 'catalog.product.feature',
      entityType: 'Product',
      entityId: id,
      before: { isFeatured: product.isFeatured },
      after: { isFeatured },
    });
    return toProductDto(updated);
  }

  // ================================================================ helpers

  private async list(query: ProductListParams): Promise<Paginated<ProductListItem>> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              {
                variants: {
                  some: { sku: { contains: query.search, mode: 'insensitive' as const } },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productListInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(rows.map(toProductListItem), total, query.page, query.limit);
  }

  /**
   * Checks the option combinations and returns each variant's label ("Black / 256GB").
   * Rules: all variants use the same attributes (one value each); combinations are unique;
   * more than one variant requires options.
   */
  private async validateCombinations(variants: ProductVariantInputDto[]): Promise<string[]> {
    const allIds = [...new Set(variants.flatMap((v) => v.valueIds))];
    if (allIds.length === 0) {
      if (variants.length > 1)
        throw new BadRequestException('Several variants need options (e.g. Color, Size)');
      return [''];
    }

    const values = await this.prisma.attributeValue.findMany({
      where: { id: { in: allIds } },
      include: { attribute: true },
    });
    const byId = new Map(values.map((v) => [v.id, v]));
    const missing = allIds.filter((id) => !byId.has(id));
    if (missing.length > 0)
      throw new BadRequestException(`Unknown attribute values: ${missing.join(', ')}`);

    let signature: string | null = null;
    const combos = new Set<string>();
    return variants.map((v, i) => {
      const vals = v.valueIds.map((id) => byId.get(id)!);
      const attributeIds = vals.map((x) => x.attributeId);
      if (new Set(attributeIds).size !== attributeIds.length) {
        throw new BadRequestException(`Variant ${i + 1} has two values for the same attribute`);
      }
      const sig = [...attributeIds].sort().join('|');
      if (signature === null) signature = sig;
      else if (sig !== signature)
        throw new BadRequestException('Every variant must use the same attributes');

      const key = variantComboKey(v.valueIds);
      if (combos.has(key))
        throw new BadRequestException(`Variant ${i + 1} duplicates another combination`);
      combos.add(key);

      return [...vals]
        .sort(
          (a, b) =>
            a.attribute.position - b.attribute.position ||
            a.attribute.name.localeCompare(b.attribute.name),
        )
        .map((x) => x.label ?? x.value)
        .join(' / ');
    });
  }

  private async transition(
    actorId: string | undefined,
    product: ProductWithDetail,
    from: ProductStatus[],
    to: ProductStatus,
    action: string,
    extra: Prisma.ProductUpdateInput = {},
  ): Promise<ProductDto> {
    const current = product.status as ProductStatus;
    if (!from.includes(current)) {
      throw new BadRequestException(
        `A ${PRODUCT_STATUS_LABELS[current].toLowerCase()} product cannot be moved to ${PRODUCT_STATUS_LABELS[to].toLowerCase()}`,
      );
    }
    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        ...extra,
        status: to,
        ...(to === 'PUBLISHED' && !product.publishedAt ? { publishedAt: new Date() } : {}),
      },
      include: productDetailInclude,
    });
    await this.audit.log({
      actorId,
      action,
      entityType: 'Product',
      entityId: product.id,
      before: { status: current, rejectionReason: product.rejectionReason },
      after: { status: to, rejectionReason: updated.rejectionReason },
    });
    return toProductDto(updated);
  }

  private async vendorOf(
    userId: string,
    opts: { requireApproved?: boolean } = {},
  ): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findFirst({
      where: ownedOrStaffed(userId),
      orderBy: { createdAt: 'asc' },
    });
    if (!vendor) throw new NotFoundException('No store is linked to this account');
    if (opts.requireApproved && vendor.status !== 'APPROVED') {
      throw new ForbiddenException('Your store must be approved before you can manage products');
    }
    return vendor;
  }

  private async findOwned(vendorId: string, id: string): Promise<ProductWithDetail> {
    const product = await this.prisma.product.findFirst({
      where: { id, vendorId, deletedAt: null },
      include: productDetailInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async findAny(id: string): Promise<ProductWithDetail> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: productDetailInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async assertRefs(categoryId: string, brandId: string | null | undefined) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { isActive: true },
    });
    if (!category || !category.isActive) throw new BadRequestException('Choose an active category');
    if (brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { isActive: true },
      });
      if (!brand || !brand.isActive) throw new BadRequestException('Choose an active brand');
    }
  }

  /** SKUs are unique across the whole marketplace. `exceptIds` = variants allowed to hold them. */
  private async assertSkusFree(skus: string[], exceptIds: string[] = []) {
    const clashes = await this.prisma.productVariant.findMany({
      where: { sku: { in: skus }, ...(exceptIds.length ? { NOT: { id: { in: exceptIds } } } : {}) },
      select: { sku: true },
    });
    if (clashes.length > 0) {
      throw new ConflictException(
        `SKU already used by another product: ${clashes.map((c) => c.sku).join(', ')}`,
      );
    }
  }

  private async approvalRequired(): Promise<boolean> {
    const setting = await this.prisma.setting.findUnique({ where: { key: APPROVAL_SETTING } });
    return setting ? setting.value !== false : true;
  }

  private async emailVendor(
    product: ProductWithDetail,
    template: EmailJobPayload['template'],
    data: { heading: string; body: string },
  ): Promise<void> {
    try {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: product.vendor.id },
        select: { email: true, ownerId: true },
      });
      if (!vendor) return;
      const base = this.config.get<string>('NEXT_PUBLIC_VENDOR_URL', 'http://localhost:3002');
      await this.notifications.sendEmail({
        template,
        to: vendor.email,
        userId: vendor.ownerId,
        data: {
          ...data,
          productName: product.name,
          ctaLabel: 'Open product',
          ctaUrl: `${base}/products/${product.id}`,
        },
      });
    } catch (error) {
      this.logger.error(`Could not queue ${template} for product ${product.id}: ${String(error)}`);
    }
  }

  private resolveSlug(
    requested: string | undefined,
    name: string,
    excludeId?: string,
  ): Promise<string> {
    return uniqueSlug({
      requested,
      source: name,
      entity: 'product',
      isTaken: async (slug) =>
        Boolean(
          await this.prisma.product.findFirst({
            where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
            select: { id: true },
          }),
        ),
    });
  }
}

function assertPrices(price: number, compareAtPrice: number | null | undefined) {
  if (compareAtPrice !== null && compareAtPrice !== undefined && compareAtPrice <= price) {
    throw new BadRequestException('Compare-at price must be higher than the price');
  }
}
