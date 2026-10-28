import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers';

const provider = new MockPaymentProvider({
  secret: 's3cret',
  siteUrl: 'http://shop',
  enabled: true,
});

function setup(orderStatus = 'PENDING_PAYMENT') {
  const payment = {
    id: 'p1',
    orderId: 'o1',
    method: 'CARD',
    provider: 'mock',
    status: 'PENDING',
    amount: 105,
    currency: 'USD',
    providerRef: 'mock_p1',
    order: { id: 'o1', orderNumber: 'ORD-1', status: orderStatus },
  };
  const tx = {
    payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    transaction: { create: jest.fn() },
    order: {
      updateMany: jest.fn().mockResolvedValue({ count: orderStatus === 'PENDING_PAYMENT' ? 1 : 0 }),
    },
    vendorOrder: {
      findMany: jest.fn().mockResolvedValue([{ id: 'vo1' }]),
      updateMany: jest.fn(),
    },
    orderStatusHistory: { createMany: jest.fn() },
    stockReservation: { updateMany: jest.fn() },
  };
  const prisma = {
    webhookEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    payment: { findFirst: jest.fn().mockResolvedValue(payment), updateMany: jest.fn() },
    order: { findUniqueOrThrow: jest.fn().mockRejectedValue(new Error('no email in tests')) },
    setting: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    { log: jest.fn() } as unknown as AuditService,
    { sendEmail: jest.fn() } as unknown as NotificationsService,
    { get: jest.fn((_k: string, f?: unknown) => f) } as unknown as ConfigService,
    {
      byName: jest.fn(async (code: string) => (code === provider.name ? provider : null)),
      active: jest.fn(async () => ({ provider, methods: provider.methods })),
    } as never,
    { restoreForCancellation: jest.fn() } as never,
  );
  return { prisma, tx, service };
}

describe('PaymentsService — webhooks', () => {
  it('rejects a webhook with a bad signature', async () => {
    const { service } = setup();
    const { rawBody } = provider.simulate('mock_p1', 105, 'success');
    await expect(
      service.handleWebhook('mock', { 'x-mock-signature': 'nope' }, rawBody),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('confirms the order when the payment succeeds', async () => {
    const { service, tx, prisma } = setup();
    const { headers, rawBody } = provider.simulate('mock_p1', 105, 'success');
    await expect(service.handleWebhook('mock', headers, rawBody)).resolves.toEqual({
      received: true,
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', paymentStatus: 'PAID' },
    });
    expect(tx.vendorOrder.updateMany).toHaveBeenCalled();
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { processedAt: expect.any(Date), error: null } }),
    );
  });

  it('ignores an event it has already processed', async () => {
    const { service, prisma, tx } = setup();
    prisma.webhookEvent.findUnique.mockResolvedValue({ processedAt: new Date() });
    const { headers, rawBody } = provider.simulate('mock_p1', 105, 'success');
    await expect(service.handleWebhook('mock', headers, rawBody)).resolves.toEqual({
      received: true,
      duplicate: true,
    });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it('does not confirm when the captured amount differs', async () => {
    const { service, tx } = setup();
    const { headers, rawBody } = provider.simulate('mock_p1', 1, 'success');
    await service.handleWebhook('mock', headers, rawBody);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });
});
