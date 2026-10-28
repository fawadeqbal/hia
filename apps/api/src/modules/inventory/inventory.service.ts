import { ownedOrStaffed } from '../../common/utils/vendor-scope';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type StockLevel, type Vendor, type Warehouse } from '@ecommerce/database';
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  EmailTemplateKey,
  slugify,
  stockStatus,
  type LowStockRow,
  type Paginated,
  type StockMovementDto,
  type StockMovementType,
  type StockRow,
  type WarehouseAddress,
  type WarehouseDto,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  CreateWarehouseDto,
  LowStockQueryDto,
  MovementQueryDto,
  StockAdjustDto,
  StockQueryDto,
  UpdateWarehouseDto,
} from './dto/inventory.dto';

type StockFilters = Pick<StockQueryDto, 'page' | 'limit' | 'warehouseId' | 'search' | 'filter'>;

/** Change applied to one stock level. Reused later by checkout (RESERVATION / SALE / RELEASE). */
export interface StockChange {
  variantId: string;
  warehouseId: string;
  delta: number;
  type: StockMovementType;
  note?: string | null;
  reference?: string | null;
  actorId?: string;
}

/**
 * Inventory: warehouses, stock levels per variant per warehouse, and an append-only movement log.
 * Rules: on hand can never drop below reserved (or 0); every change writes a StockMovement;
 * crossing the low-stock threshold emails the seller; going from 0 to available emails waiting customers.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ================================================================ warehouses

  async listWarehouses(userId: string): Promise<WarehouseDto[]> {
    const vendor = await this.vendorOf(userId);
    await this.ensureMainWarehouse(vendor);
    const warehouses = await this.prisma.warehouse.findMany({
      where: { vendorId: vendor.id },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    const totals = await this.prisma.stockLevel.groupBy({
      by: ['warehouseId'],
      where: { warehouseId: { in: warehouses.map((w) => w.id) } },
      _sum: { quantity: true },
    });
    const byId = new Map(totals.map((t) => [t.warehouseId, t._sum.quantity ?? 0]));
    return warehouses.map((w) => toWarehouseDto(w, byId.get(w.id) ?? 0));
  }

  async createWarehouse(userId: string, dto: CreateWarehouseDto): Promise<WarehouseDto> {
    const vendor = await this.vendorOf(userId);
    const code = await this.resolveCode(dto.code, `${vendor.slug}-${dto.name}`);
    const created = await this.prisma.warehouse.create({
      data: {
        vendorId: vendor.id,
        name: dto.name,
        code,
        address: (dto.address ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'inventory.warehouse.create',
      entityType: 'Warehouse',
      entityId: created.id,
      after: created,
    });
    return toWarehouseDto(created, 0);
  }

  async updateWarehouse(
    userId: string,
    id: string,
    dto: UpdateWarehouseDto,
  ): Promise<WarehouseDto> {
    const vendor = await this.vendorOf(userId);
    const warehouse = await this.ownWarehouse(vendor.id, id);
    const units = await this.unitsIn(id);

    if (dto.isActive === false && warehouse.isActive) {
      const otherActive = await this.prisma.warehouse.count({
        where: { vendorId: vendor.id, isActive: true, NOT: { id } },
      });
      if (otherActive === 0)
        throw new BadRequestException('You need at least one active warehouse');
      if (units > 0)
        throw new BadRequestException(
          `Move or clear the ${units} units in this warehouse before deactivating it`,
        );
    }
    const code =
      dto.code !== undefined && dto.code !== warehouse.code
        ? await this.resolveCode(dto.code, dto.code, id)
        : undefined;

    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: {
        name: dto.name,
        code,
        address: dto.address ? (dto.address as Prisma.InputJsonValue) : undefined,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'inventory.warehouse.update',
      entityType: 'Warehouse',
      entityId: id,
      before: warehouse,
      after: updated,
    });
    return toWarehouseDto(updated, units);
  }

  // ================================================================ stock

  /** The seller's variants with their stock in one warehouse. Filtering by status happens in memory (per-store data is bounded). */
  async listStock(userId: string, query: StockFilters): Promise<Paginated<StockRow>> {
    const vendor = await this.vendorOf(userId);
    const main = await this.ensureMainWarehouse(vendor);
    const warehouseId = query.warehouseId ?? main.id;
    await this.ownWarehouse(vendor.id, warehouseId);

    const variants = await this.prisma.productVariant.findMany({
      where: {
        product: { vendorId: vendor.id, deletedAt: null },
        ...(query.search
          ? {
              OR: [
                { sku: { contains: query.search, mode: 'insensitive' as const } },
                { name: { contains: query.search, mode: 'insensitive' as const } },
                { product: { name: { contains: query.search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        sku: true,
        name: true,
        isActive: true,
        product: {
          select: {
            id: true,
            name: true,
            images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
          },
        },
        stockLevels: { where: { warehouseId } },
      },
      orderBy: [{ product: { name: 'asc' } }, { position: 'asc' }],
    });

    const rows: StockRow[] = variants.map((v) => {
      const level = v.stockLevels[0];
      const quantity = level?.quantity ?? 0;
      const reserved = level?.reserved ?? 0;
      const threshold = level?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
      const available = quantity - reserved;
      return {
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        variantName: v.name,
        sku: v.sku,
        imageUrl: v.product.images[0]?.url ?? null,
        isActive: v.isActive,
        warehouseId,
        quantity,
        reserved,
        available,
        lowStockThreshold: threshold,
        status: stockStatus(available, threshold),
      };
    });

    const filtered =
      query.filter === 'low'
        ? rows.filter((r) => r.status === 'low')
        : query.filter === 'out'
          ? rows.filter((r) => r.status === 'out')
          : rows;
    const start = (query.page - 1) * query.limit;
    return paginate(
      filtered.slice(start, start + query.limit),
      filtered.length,
      query.page,
      query.limit,
    );
  }

  async adjust(userId: string, dto: StockAdjustDto): Promise<StockRow> {
    const vendor = await this.vendorOf(userId);
    const warehouse = await this.ownWarehouse(vendor.id, dto.warehouseId);
    if (!warehouse.isActive) throw new BadRequestException('This warehouse is inactive');
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variantId, product: { vendorId: vendor.id, deletedAt: null } },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const current = await this.prisma.stockLevel.findUnique({
      where: { variantId_warehouseId: { variantId: dto.variantId, warehouseId: dto.warehouseId } },
    });
    const onHand = current?.quantity ?? 0;
    const delta =
      dto.mode === 'set'
        ? dto.quantity - onHand
        : dto.mode === 'add'
          ? dto.quantity
          : -dto.quantity;

    if (dto.lowStockThreshold !== undefined) {
      await this.prisma.stockLevel.upsert({
        where: {
          variantId_warehouseId: { variantId: dto.variantId, warehouseId: dto.warehouseId },
        },
        update: { lowStockThreshold: dto.lowStockThreshold },
        create: {
          variantId: dto.variantId,
          warehouseId: dto.warehouseId,
          lowStockThreshold: dto.lowStockThreshold,
        },
      });
    }
    if (delta !== 0) {
      await this.applyChange({
        variantId: dto.variantId,
        warehouseId: dto.warehouseId,
        delta,
        type: dto.type,
        note: dto.note,
        actorId: userId,
      });
    }
    return this.stockRow(dto.variantId, dto.warehouseId);
  }

  /**
   * Applies one stock change atomically (increment + movement) and fires alerts.
   * Public so checkout / returns can reuse it.
   */
  async applyChange(change: StockChange): Promise<StockLevel> {
    const { before, after } = await this.prisma.$transaction(async (tx) => {
      const before = await tx.stockLevel.upsert({
        where: {
          variantId_warehouseId: { variantId: change.variantId, warehouseId: change.warehouseId },
        },
        update: {},
        create: { variantId: change.variantId, warehouseId: change.warehouseId },
      });
      const after = await tx.stockLevel.update({
        where: { id: before.id },
        data: { quantity: { increment: change.delta } },
      });
      // Checked after the atomic increment so concurrent changes can never oversell.
      if (after.quantity < 0) throw new BadRequestException('Stock cannot go below 0');
      if (after.quantity < after.reserved) {
        throw new BadRequestException(
          `Stock cannot go below the ${after.reserved} units reserved for orders`,
        );
      }
      await tx.stockMovement.create({
        data: {
          variantId: change.variantId,
          warehouseId: change.warehouseId,
          type: change.type,
          quantity: change.delta,
          note: change.note ?? null,
          reference: change.reference ?? null,
          createdById: change.actorId,
        },
      });
      return { before, after };
    });

    await this.afterChange(before, after);
    return after;
  }

  async movements(userId: string, query: MovementQueryDto): Promise<Paginated<StockMovementDto>> {
    const vendor = await this.vendorOf(userId);
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: query.variantId, product: { vendorId: vendor.id } },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const where: Prisma.StockMovementWhereInput = {
      variantId: query.variantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    const userIds = [
      ...new Set(rows.map((r) => r.createdById).filter((id): id is string => Boolean(id))),
    ];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    return paginate(
      rows.map((m) => ({
        id: m.id,
        type: m.type as StockMovementType,
        quantity: m.quantity,
        note: m.note,
        reference: m.reference,
        createdBy: m.createdById ? (names.get(m.createdById) ?? null) : null,
        createdAt: m.createdAt.toISOString(),
      })),
      total,
      query.page,
      query.limit,
    );
  }

  // ================================================================ admin

  async lowStock(query: LowStockQueryDto): Promise<Paginated<LowStockRow>> {
    const search = query.search ? `%${query.search}%` : null;
    const filter = Prisma.sql`
      FROM "StockLevel" sl
      JOIN "ProductVariant" pv ON pv."id" = sl."variantId"
      JOIN "Product" p ON p."id" = pv."productId"
      JOIN "Vendor" v ON v."id" = p."vendorId"
      JOIN "Warehouse" w ON w."id" = sl."warehouseId"
      WHERE p."deletedAt" IS NULL
        AND pv."isActive" = true
        AND (sl."quantity" - sl."reserved") <= sl."lowStockThreshold"
        ${search ? Prisma.sql`AND (p."name" ILIKE ${search} OR pv."sku" ILIKE ${search} OR v."name" ILIKE ${search})` : Prisma.empty}`;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<LowStockRow[]>(Prisma.sql`
        SELECT pv."id" AS "variantId", p."id" AS "productId", p."name" AS "productName", pv."name" AS "variantName",
               pv."sku", v."id" AS "vendorId", v."name" AS "vendorName", w."name" AS "warehouseName",
               sl."quantity", sl."reserved", (sl."quantity" - sl."reserved") AS "available", sl."lowStockThreshold"
        ${filter}
        ORDER BY (sl."quantity" - sl."reserved") ASC, p."name" ASC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`),
      this.prisma.$queryRaw<{ count: number }[]>(
        Prisma.sql`SELECT COUNT(*)::int AS "count" ${filter}`,
      ),
    ]);
    return paginate(rows, countRows[0]?.count ?? 0, query.page, query.limit);
  }

  // ================================================================ helpers

  private async stockRow(variantId: string, warehouseId: string): Promise<StockRow> {
    const v = await this.prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: {
        id: true,
        sku: true,
        name: true,
        isActive: true,
        product: {
          select: {
            id: true,
            name: true,
            images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
          },
        },
        stockLevels: { where: { warehouseId } },
      },
    });
    const level = v.stockLevels[0];
    const quantity = level?.quantity ?? 0;
    const reserved = level?.reserved ?? 0;
    const threshold = level?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
    return {
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      variantName: v.name,
      sku: v.sku,
      imageUrl: v.product.images[0]?.url ?? null,
      isActive: v.isActive,
      warehouseId,
      quantity,
      reserved,
      available: quantity - reserved,
      lowStockThreshold: threshold,
      status: stockStatus(quantity - reserved, threshold),
    };
  }

  /** Low-stock email to the seller (when crossing the threshold) and back-in-stock emails to customers. */
  private async afterChange(before: StockLevel, after: StockLevel) {
    const availableBefore = before.quantity - before.reserved;
    const availableAfter = after.quantity - after.reserved;
    try {
      if (availableBefore > after.lowStockThreshold && availableAfter <= after.lowStockThreshold) {
        await this.sendLowStockEmail(after, availableAfter);
      }
      if (availableBefore <= 0 && availableAfter > 0) {
        await this.notifyBackInStock(after.variantId);
      }
    } catch (error) {
      this.logger.error(`Stock alerts failed for variant ${after.variantId}: ${String(error)}`);
    }
  }

  private async sendLowStockEmail(level: StockLevel, available: number) {
    const info = await this.prisma.productVariant.findUnique({
      where: { id: level.variantId },
      select: {
        sku: true,
        name: true,
        product: { select: { name: true, vendor: { select: { email: true, ownerId: true } } } },
      },
    });
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: level.warehouseId },
      select: { name: true },
    });
    if (!info) return;
    const label = `${info.product.name}${info.name ? ` (${info.name})` : ''}`;
    await this.notifications.sendEmail({
      template: EmailTemplateKey.VENDOR_LOW_STOCK,
      to: info.product.vendor.email,
      userId: info.product.vendor.ownerId,
      data: {
        heading: available <= 0 ? 'Out of stock' : 'Low stock alert',
        body: `${label}, SKU ${info.sku}, has ${Math.max(available, 0)} units available in ${warehouse?.name ?? 'your warehouse'}.`,
        ctaLabel: 'Restock now',
        ctaUrl: `${this.config.get<string>('NEXT_PUBLIC_VENDOR_URL', 'http://localhost:3002')}/inventory`,
      },
    });
  }

  private async notifyBackInStock(variantId: string) {
    const alerts = await this.prisma.stockAlert.findMany({
      where: { variantId, notifiedAt: null },
      include: {
        variant: { select: { name: true, product: { select: { name: true, slug: true } } } },
      },
    });
    const site = this.config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    for (const alert of alerts) {
      const productName = `${alert.variant.product.name}${alert.variant.name ? ` (${alert.variant.name})` : ''}`;
      await this.notifications.sendEmail({
        template: EmailTemplateKey.BACK_IN_STOCK,
        to: alert.email,
        userId: alert.userId ?? undefined,
        data: {
          productName,
          heading: `${productName} is back in stock`,
          body: 'The item you asked about is available again. Quantities may be limited.',
          ctaLabel: 'Shop now',
          ctaUrl: `${site}/products/${alert.variant.product.slug}`,
        },
      });
    }
    if (alerts.length > 0) {
      await this.prisma.stockAlert.updateMany({
        where: { id: { in: alerts.map((a) => a.id) } },
        data: { notifiedAt: new Date() },
      });
    }
  }

  private async vendorOf(userId: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findFirst({
      where: ownedOrStaffed(userId),
      orderBy: { createdAt: 'asc' },
    });
    if (!vendor) throw new NotFoundException('No store is linked to this account');
    if (vendor.status !== 'APPROVED')
      throw new ForbiddenException('Your store must be approved to manage inventory');
    return vendor;
  }

  /** Every store gets a "Main warehouse" the first time inventory is used. */
  private async ensureMainWarehouse(vendor: Vendor): Promise<Warehouse> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { vendorId: vendor.id, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.warehouse.create({
      data: {
        vendorId: vendor.id,
        name: 'Main warehouse',
        code: await this.resolveCode(undefined, `${vendor.slug}-main`),
        address: {},
      },
    });
  }

  private async ownWarehouse(vendorId: string, id: string): Promise<Warehouse> {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, vendorId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  private async unitsIn(warehouseId: string): Promise<number> {
    const sum = await this.prisma.stockLevel.aggregate({
      where: { warehouseId },
      _sum: { quantity: true },
    });
    return sum._sum.quantity ?? 0;
  }

  /** Warehouse codes are global and uppercase ("DEMO-ELECTRONICS-MAIN", "-2"…). */
  private async resolveCode(
    requested: string | undefined,
    source: string,
    excludeId?: string,
  ): Promise<string> {
    const taken = async (code: string) =>
      Boolean(
        await this.prisma.warehouse.findFirst({
          where: { code, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
          select: { id: true },
        }),
      );
    if (requested) {
      if (await taken(requested))
        throw new BadRequestException(`Warehouse code "${requested}" is already used`);
      return requested;
    }
    const base = (slugify(source) || 'warehouse').toUpperCase().slice(0, 36);
    let code = base;
    for (let i = 2; await taken(code); i++) code = `${base}-${i}`;
    return code;
  }
}

function toWarehouseDto(w: Warehouse, totalUnits: number): WarehouseDto {
  return {
    id: w.id,
    name: w.name,
    code: w.code,
    address: (w.address as WarehouseAddress | null) ?? null,
    isActive: w.isActive,
    totalUnits,
    createdAt: w.createdAt.toISOString(),
  };
}
