import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { InventoryService } from './inventory.service';

const vendor = {
  id: 'v1',
  ownerId: 'u1',
  slug: 'demo',
  status: 'APPROVED',
  email: 'seller@example.com',
};
const warehouse = {
  id: 'w1',
  vendorId: 'v1',
  name: 'Main warehouse',
  code: 'DEMO-MAIN',
  address: {},
  isActive: true,
  createdAt: new Date(),
};
const level = (quantity: number, reserved = 0, lowStockThreshold = 5) => ({
  id: 'sl1',
  variantId: 'var1',
  warehouseId: 'w1',
  quantity,
  reserved,
  lowStockThreshold,
  updatedAt: new Date(),
});
const variantRow = {
  id: 'var1',
  sku: 'SKU-1',
  name: null,
  isActive: true,
  product: { id: 'p1', name: 'Phone', images: [], vendor: { email: vendor.email, ownerId: 'u1' } },
  stockLevels: [level(10)],
};

function setup(current: ReturnType<typeof level> | null, afterQty: number, afterReserved = 0) {
  const tx = {
    stockLevel: {
      upsert: jest.fn().mockResolvedValue(current ?? level(0)),
      update: jest.fn().mockResolvedValue(level(afterQty, afterReserved)),
    },
    stockMovement: { create: jest.fn() },
  };
  const prisma = {
    vendor: { findFirst: jest.fn().mockResolvedValue(vendor) },
    warehouse: {
      findFirst: jest.fn().mockResolvedValue(warehouse),
      findUnique: jest.fn().mockResolvedValue(warehouse),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    },
    productVariant: {
      findFirst: jest.fn().mockResolvedValue({ id: 'var1' }),
      findUnique: jest.fn().mockResolvedValue(variantRow),
      findUniqueOrThrow: jest.fn().mockResolvedValue(variantRow),
    },
    stockLevel: {
      findUnique: jest.fn().mockResolvedValue(current),
      upsert: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
    },
    stockAlert: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const notifications = { sendEmail: jest.fn() };
  const config = { get: jest.fn((_k: string, fallback?: unknown) => fallback) };
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    { log: jest.fn() } as unknown as AuditService,
    notifications as unknown as NotificationsService,
    config as unknown as ConfigService,
  );
  return { prisma, tx, notifications, service };
}

const adjust = (mode: 'set' | 'add' | 'remove', quantity: number) => ({
  variantId: 'var1',
  warehouseId: 'w1',
  mode,
  quantity,
  type: 'ADJUSTMENT' as const,
});

describe('InventoryService', () => {
  it('"set" converts the target quantity into a signed movement', async () => {
    const { tx, service } = setup(level(10), 4);
    await service.adjust('u1', adjust('set', 4));
    expect(tx.stockLevel.update).toHaveBeenCalledWith({
      where: { id: 'sl1' },
      data: { quantity: { increment: -6 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'ADJUSTMENT', quantity: -6, createdById: 'u1' }),
    });
  });

  it('records nothing when the quantity does not change', async () => {
    const { prisma, service } = setup(level(10), 10);
    await service.adjust('u1', adjust('set', 10));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('never lets on-hand stock drop below reserved units', async () => {
    const { service } = setup(level(10, 8), 5, 8);
    await expect(service.adjust('u1', adjust('remove', 5))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('emails the seller when stock crosses the low-stock threshold', async () => {
    const { notifications, service } = setup(level(8), 3);
    await service.adjust('u1', adjust('remove', 5));
    expect(notifications.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'vendor.low-stock' }),
    );
  });

  it('does not re-send the low-stock email while already below the threshold', async () => {
    const { notifications, service } = setup(level(3), 2);
    await service.adjust('u1', adjust('remove', 1));
    expect(notifications.sendEmail).not.toHaveBeenCalled();
  });

  it('notifies waiting customers when an item comes back in stock', async () => {
    const { prisma, notifications, service } = setup(level(0), 10);
    prisma.stockAlert.findMany.mockResolvedValue([
      {
        id: 'a1',
        email: 'buyer@example.com',
        userId: null,
        variant: { name: null, product: { name: 'Phone', slug: 'phone' } },
      },
    ]);
    await service.adjust('u1', { ...adjust('add', 10), type: 'PURCHASE' as const });
    expect(notifications.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'marketing.back-in-stock', to: 'buyer@example.com' }),
    );
    expect(prisma.stockAlert.updateMany).toHaveBeenCalled();
  });

  it("rejects another store's variant", async () => {
    const { prisma, service } = setup(level(10), 10);
    prisma.productVariant.findFirst.mockResolvedValue(null);
    await expect(service.adjust('u1', adjust('add', 1))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires an approved store', async () => {
    const { prisma, service } = setup(level(10), 10);
    prisma.vendor.findFirst.mockResolvedValue({ ...vendor, status: 'PENDING' });
    await expect(service.adjust('u1', adjust('add', 1))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps at least one active warehouse', async () => {
    const { service } = setup(level(0), 0);
    await expect(service.updateWarehouse('u1', 'w1', { isActive: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
