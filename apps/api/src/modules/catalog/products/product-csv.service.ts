import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  PRODUCT_CSV_COLUMNS,
  PRODUCT_IMPORT_MAX_ROWS,
  parseCsv,
  type CsvExportDto,
  type ProductImportResult,
  type ProductImportRow,
} from '@ecommerce/types';
import { ownedOrStaffed } from '../../../common/utils/vendor-scope';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { createProblems, mapHeader, readRow } from './product-csv-rules';
import { ProductsService } from './products.service';

const exportSelect = {
  name: true,
  status: true,
  basePrice: true,
  compareAtPrice: true,
  shortDescription: true,
  description: true,
  weightGrams: true,
  taxClass: true,
  category: { select: { slug: true } },
  brand: { select: { slug: true } },
  vendor: { select: { name: true } },
  variants: { where: { isDefault: true }, select: { sku: true }, take: 1 },
} as const;

/**
 * Product CSV. Sellers: export their products, import to create (as drafts) or update by SKU — through ProductsService,
 * so every product rule (refs, prices, unique SKU, moderation) applies. Staff: export all products.
 * Only simple products (no options) are updated by import; variants stay in the product editor.
 */
@Injectable()
export class ProductCsvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly audit: AuditService,
  ) {}

  async vendorExport(userId: string): Promise<CsvExportDto> {
    const vendor = await this.vendorOf(userId);
    const rows = await this.prisma.product.findMany({
      where: { vendorId: vendor.id, deletedAt: null },
      select: exportSelect,
      orderBy: { createdAt: 'asc' },
    });
    return {
      filename: `products-${vendor.slug}.csv`,
      rows: [[...PRODUCT_CSV_COLUMNS], ...rows.map((p) => this.line(p))],
    };
  }

  async adminExport(): Promise<CsvExportDto> {
    const rows = await this.prisma.product.findMany({
      where: { deletedAt: null },
      select: exportSelect,
      orderBy: { createdAt: 'asc' },
      take: 50_000,
    });
    return {
      filename: 'products.csv',
      rows: [
        [...PRODUCT_CSV_COLUMNS, 'seller'],
        ...rows.map((p) => [...this.line(p), p.vendor.name]),
      ],
    };
  }

  async vendorImport(userId: string, csv: string, dryRun: boolean): Promise<ProductImportResult> {
    const vendor = await this.vendorOf(userId);
    const table = parseCsv(csv);
    if (table.length < 2)
      throw new BadRequestException('The file needs a header row and at least one product');
    if (table.length - 1 > PRODUCT_IMPORT_MAX_ROWS)
      throw new BadRequestException(`At most ${PRODUCT_IMPORT_MAX_ROWS} products per file`);
    const { index, missing } = mapHeader(table[0]!);
    if (missing.length) throw new BadRequestException(`Missing column: ${missing.join(', ')}`);

    const [categories, brands, mine, taken] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, slug: true } }),
      this.prisma.brand.findMany({ select: { id: true, slug: true } }),
      this.prisma.productVariant.findMany({
        where: { product: { vendorId: vendor.id, deletedAt: null } },
        select: {
          sku: true,
          isDefault: true,
          product: { select: { id: true, _count: { select: { variants: true } } } },
        },
      }),
      this.prisma.productVariant.findMany({
        where: { product: { vendorId: { not: vendor.id } } },
        select: { sku: true },
      }),
    ]);
    const catId = new Map(categories.map((c) => [c.slug, c.id]));
    const brandId = new Map(brands.map((b) => [b.slug, b.id]));
    const ownSku = new Map(mine.map((v) => [v.sku.toLowerCase(), v]));
    const otherSku = new Set(taken.map((t) => t.sku.toLowerCase()));
    const seen = new Set<string>();

    const result: ProductImportResult = { dryRun, created: 0, updated: 0, errors: 0, rows: [] };
    for (const [i, cells] of table.slice(1).entries()) {
      const line = i + 2;
      const { row, problems } = readRow(cells, index);
      const key = row.sku.toLowerCase();
      if (seen.has(key)) problems.push('sku appears twice in the file');
      seen.add(key);
      if (row.category && !catId.has(row.category))
        problems.push(`unknown category "${row.category}"`);
      if (row.brand && !brandId.has(row.brand)) problems.push(`unknown brand "${row.brand}"`);
      const existing = ownSku.get(key);
      if (!existing && otherSku.has(key)) problems.push('sku is used by another seller');
      if (existing && !existing.isDefault)
        problems.push('sku belongs to a product option; edit it in the product editor');
      if (existing && existing.product._count.variants > 1)
        problems.push('product has options; edit it in the product editor');
      if (!existing) problems.push(...createProblems(row));
      const out: ProductImportRow = {
        line,
        sku: row.sku,
        action: existing ? 'update' : 'create',
        message: null,
      };
      if (problems.length) {
        Object.assign(out, { action: 'error', message: problems.join('; ') });
        result.errors++;
        result.rows.push(out);
        continue;
      }
      if (!dryRun) {
        const fields = {
          name: row.name,
          categoryId: row.category ? catId.get(row.category) : undefined,
          brandId: row.brand ? brandId.get(row.brand) : undefined,
          basePrice: row.price,
          compareAtPrice: row.compareAtPrice,
          shortDescription: row.shortDescription,
          description: row.description,
          weightGrams: row.weightGrams,
          taxClass: row.taxClass,
        };
        try {
          if (existing) {
            await this.products.update(userId, existing.product.id, {
              ...strip(fields),
              sku: row.sku,
            } as UpdateProductDto);
          } else {
            await this.products.create(userId, {
              ...strip(fields),
              sku: row.sku,
            } as CreateProductDto);
          }
        } catch (error) {
          Object.assign(out, { action: 'error', message: (error as Error).message });
          result.errors++;
          result.rows.push(out);
          continue;
        }
      }
      if (out.action === 'create') result.created++;
      else result.updated++;
      result.rows.push(out);
    }
    if (!dryRun)
      await this.audit.log({
        actorId: userId,
        action: 'catalog.product.import',
        entityType: 'Vendor',
        entityId: vendor.id,
        after: { created: result.created, updated: result.updated, errors: result.errors },
      });
    return result;
  }

  private line(p: {
    name: string;
    status: string;
    basePrice: unknown;
    compareAtPrice: unknown;
    shortDescription: string | null;
    description: string | null;
    weightGrams: number | null;
    taxClass: string | null;
    category: { slug: string };
    brand: { slug: string } | null;
    variants: { sku: string }[];
  }): string[] {
    return [
      p.variants[0]?.sku ?? '',
      p.name,
      p.category.slug,
      p.brand?.slug ?? '',
      String(Number(p.basePrice)),
      p.compareAtPrice === null ? '' : String(Number(p.compareAtPrice)),
      p.shortDescription ?? '',
      p.description ?? '',
      p.weightGrams === null ? '' : String(p.weightGrams),
      p.taxClass ?? 'standard',
      p.status,
    ];
  }

  private async vendorOf(userId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: ownedOrStaffed(userId),
      orderBy: { createdAt: 'asc' },
    });
    if (!vendor || vendor.status !== 'APPROVED')
      throw new ForbiddenException('Your store is not approved');
    return vendor;
  }
}

const strip = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
