import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  PRODUCT_CSV_COLUMNS,
  emptyImportResult,
  pushImportRow,
  type CsvExportDto,
  type ProductImportResult,
  type SheetRow,
} from '@ecommerce/types';
import { sheetRowsAsText } from '../../../common/dto/import.dto';
import { assertSheetSize, isEmptyRow } from '../../../common/utils/sheet-cells';
import { ownedOrStaffed } from '../../../common/utils/vendor-scope';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { changedFields, createProblems, readRow, type CsvRow } from './product-csv-rules';
import { ProductsService } from './products.service';

const exportSelect = {
  name: true,
  status: true,
  basePrice: true,
  compareAtPrice: true,
  shortDescription: true,
  description: true,
  weightGrams: true,
  category: { select: { slug: true } },
  variants: { where: { isDefault: true }, select: { sku: true }, take: 1 },
} as const;

/**
 * Product Excel: export the shop's products; upload to create (as drafts) or update by SKU — through
 * ProductsService, so every product rule (category, prices, unique SKU) applies. Checks every row first
 * and saves only when the whole file is valid. Rows that change nothing are fine for products with
 * options; changing such a product is done in the product page.
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

  async vendorImport(
    userId: string,
    rawRows: SheetRow[],
    dryRun: boolean,
  ): Promise<ProductImportResult> {
    const rows = sheetRowsAsText(rawRows);
    assertSheetSize(rows, 'product');
    if (!rows.some((r) => 'sku' in r)) throw new BadRequestException('Missing column: sku');
    const vendor = await this.vendorOf(userId);

    const [categories, mine, taken] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, slug: true } }),
      this.prisma.productVariant.findMany({
        where: { product: { vendorId: vendor.id, deletedAt: null } },
        select: {
          sku: true,
          isDefault: true,
          product: {
            select: {
              id: true,
              name: true,
              basePrice: true,
              compareAtPrice: true,
              shortDescription: true,
              description: true,
              weightGrams: true,
              category: { select: { slug: true } },
              _count: { select: { variants: true } },
            },
          },
        },
      }),
      this.prisma.productVariant.findMany({
        where: { product: { vendorId: { not: vendor.id } } },
        select: { sku: true },
      }),
    ]);
    const catId = new Map(categories.map((c) => [c.slug, c.id]));
    const ownSku = new Map(mine.map((v) => [v.sku.toLowerCase(), v]));
    const otherSku = new Set(taken.map((t) => t.sku.toLowerCase()));
    const seen = new Set<string>();

    const result: ProductImportResult = emptyImportResult(dryRun);
    const saves: { row: CsvRow; productId: string | null }[] = [];
    for (const [i, sheetRow] of rows.entries()) {
      if (isEmptyRow(sheetRow)) continue;
      const line = i + 2;
      const { row, problems } = readRow(sheetRow);
      const key = row.sku.toLowerCase();
      if (seen.has(key)) problems.push('this SKU is in the file twice');
      seen.add(key);
      if (row.category && !catId.has(row.category))
        problems.push(`no category with the slug "${row.category}"`);
      const existing = ownSku.get(key);
      if (!existing && otherSku.has(key)) problems.push('this SKU is already used');
      if (!existing) problems.push(...createProblems(row));

      const p = existing?.product;
      const changes = p
        ? changedFields(row, {
            name: p.name,
            category: p.category.slug,
            price: Number(p.basePrice),
            compareAtPrice: p.compareAtPrice === null ? null : Number(p.compareAtPrice),
            shortDescription: p.shortDescription,
            description: p.description,
            weightGrams: p.weightGrams,
          })
        : [];
      if (existing && changes.length && !existing.isDefault)
        problems.push('this SKU is a product option; edit it in the product page');
      else if (existing && changes.length && existing.product._count.variants > 1)
        problems.push('this product has options (sizes, colours); edit it in the product page');

      if (problems.length) {
        pushImportRow(result, {
          line,
          key: row.sku,
          action: 'error',
          message: problems.join('; '),
        });
      } else if (!existing) {
        saves.push({ row, productId: null });
        pushImportRow(result, {
          line,
          key: row.sku,
          action: 'create',
          message: `New draft: ${row.name}`,
        });
      } else if (!changes.length) {
        pushImportRow(result, { line, key: row.sku, action: 'unchanged', message: null });
      } else {
        saves.push({ row, productId: existing.product.id });
        pushImportRow(result, {
          line,
          key: row.sku,
          action: 'update',
          message: `Change ${changes.join(', ')}`,
        });
      }
    }
    if (dryRun) return result;
    if (result.errors > 0)
      throw new BadRequestException('Some rows have problems. Fix them and check the file again.');

    for (const { row, productId } of saves) {
      const fields = strip({
        name: row.name,
        categoryId: row.category ? catId.get(row.category) : undefined,
        basePrice: row.price,
        compareAtPrice: row.compareAtPrice,
        shortDescription: row.shortDescription,
        description: row.description,
        weightGrams: row.weightGrams,
      });
      if (productId)
        await this.products.update(userId, productId, {
          ...fields,
          sku: row.sku,
        } as UpdateProductDto);
      else await this.products.create(userId, { ...fields, sku: row.sku } as CreateProductDto);
    }
    await this.audit.log({
      actorId: userId,
      action: 'catalog.product.import',
      entityType: 'Vendor',
      entityId: vendor.id,
      after: { created: result.created, updated: result.updated },
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
    category: { slug: string };
    variants: { sku: string }[];
  }): string[] {
    return [
      p.variants[0]?.sku ?? '',
      p.name,
      p.category.slug,
      String(Number(p.basePrice)),
      p.compareAtPrice === null ? '' : String(Number(p.compareAtPrice)),
      p.shortDescription ?? '',
      p.description ?? '',
      p.weightGrams === null ? '' : String(p.weightGrams),
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
