import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PaymentsService } from '../payments/payments.service';
import type { LoyaltyService } from '../loyalty/loyalty.service';
import { OrdersService } from './orders.service';

const vendorOrder = (status: string) => ({
  id: 'vo1',
  orderId: 'o1',
  vendorId: 'v1',
  status,
  subtotal: 100,
  shippingTotal: 5,
  commissionAmount: 10,
  netAmount: 95,
  order: {
    id: 'o1',
    orderNumber: 'ORD-1',
    email: 'buyer@example.com',
    currency: 'USD',
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    customerNote: null,
    placedAt: new Date(),
    shippingAddress: {
      fullName: 'Ali Khan',
      phone: '0300',
      line1: 'x',
      city: 'Lahore',
      countryCode: 'PK',
    },
  },
  items: [
    {
      id: 'i1',
      variantId: 'var1',
      productName: 'Phone',
      variantName: null,
      sku: 'S',
      quantity: 2,
      unitPrice: 50,
      total: 100,
      variant: { product: { slug: 'phone', images: [] } },
    },
  ],
  shipments: [],
  statusHistory: [],
});

function setup(status: string) {
  const tx = {
    vendorOrder: { update: jest.fn() },
    orderStatusHistory: { create: jest.fn() },
    shipment: { create: jest.fn(), updateMany: jest.fn() },
    stockReservation: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'r1', variantId: 'var1', warehouseId: 'w1', quantity: 2 }]),
      update: jest.fn(),
    },
    stockLevel: { update: jest.fn() },
    stockMovement: { create: jest.fn() },
    order: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'o1',
        status: 'COD_CONFIRMED',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        vendorOrders: [{ status: 'SHIPPED' }],
      }),
      update: jest.fn(),
    },
    payment: { updateMany: jest.fn() },
    productVariant: { findUnique: jest.fn() },
    product: { update: jest.fn() },
  };
  const prisma = {
    vendor: {
      findFirst: jest.fn().mockResolvedValue({ id: 'v1', status: 'APPROVED' }),
      findUnique: jest.fn().mockResolvedValue({ name: 'Demo' }),
    },
    vendorOrder: { findFirst: jest.fn().mockResolvedValue(vendorOrder(status)) },
    order: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        orderNumber: 'ORD-1',
        email: 'b@x.com',
        userId: null,
        shippingAddress: { fullName: 'Ali Khan' },
      }),
    },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    { log: jest.fn() } as unknown as AuditService,
    { sendEmail: jest.fn() } as unknown as NotificationsService,
    { get: jest.fn((_k: string, f?: unknown) => f) } as unknown as ConfigService,
    { refundOrder: jest.fn() } as unknown as PaymentsService,
    { awardForOrder: jest.fn(), restoreForCancellation: jest.fn() } as unknown as LoyaltyService,
  );
  return { tx, service };
}

describe('OrdersService — vendor status flow', () => {
  it('blocks skipping steps (confirmed → shipped)', async () => {
    const { service } = setup('COD_CONFIRMED');
    await expect(
      service.vendorUpdateStatus('u1', 'vo1', { status: 'SHIPPED', trackingNumber: 'T1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a tracking number to ship', async () => {
    const { service } = setup('PACKED');
    await expect(
      service.vendorUpdateStatus('u1', 'vo1', { status: 'SHIPPED' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('shipping commits the reserved stock as a sale and creates the shipment', async () => {
    const { tx, service } = setup('PACKED');
    await service.vendorUpdateStatus('u1', 'vo1', { status: 'SHIPPED', trackingNumber: 'TRK-1' });
    expect(tx.stockLevel.update).toHaveBeenCalledWith({
      where: { variantId_warehouseId: { variantId: 'var1', warehouseId: 'w1' } },
      data: { quantity: { decrement: 2 }, reserved: { decrement: 2 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'SALE', quantity: -2, reference: 'ORD-1' }),
    });
    expect(tx.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ trackingNumber: 'TRK-1' }),
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'SHIPPED' },
    });
  });

  it('cancelling releases the reservation', async () => {
    const { tx, service } = setup('PROCESSING');
    await service.vendorUpdateStatus('u1', 'vo1', {
      status: 'CANCELLED',
      note: 'Item damaged in storage',
    });
    expect(tx.stockLevel.update).toHaveBeenCalledWith({
      where: { variantId_warehouseId: { variantId: 'var1', warehouseId: 'w1' } },
      data: { reserved: { decrement: 2 } },
    });
  });
});
