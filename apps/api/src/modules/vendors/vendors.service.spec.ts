import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { VendorsService } from './vendors.service';

const now = new Date('2026-01-01T00:00:00Z');
const vendor = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  ownerId: 'u1',
  name: 'Demo Store',
  slug: 'demo-store',
  email: 'seller@example.com',
  phone: null,
  logoUrl: null,
  bannerUrl: null,
  description: null,
  policies: null,
  status: 'PENDING',
  statusReason: null,
  bankAccountName: null,
  bankAccountNumber: null,
  bankName: null,
  iban: null,
  ratingAverage: 0,
  approvedAt: null,
  createdAt: now,
  updatedAt: now,
  owner: { id: 'u1', email: 'seller@example.com', firstName: 'Demo', lastName: 'Seller' },
  _count: { products: 0, vendorOrders: 0 },
  ...over,
});

function setup() {
  const prisma = {
    user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    vendor: {
      findUnique: jest.fn(),
      update: jest.fn(({ data }) => Promise.resolve(vendor(data))),
    },
    commissionRule: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  const notifications = { sendEmail: jest.fn() };
  const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
  const service = new VendorsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    notifications as unknown as NotificationsService,
    config as unknown as ConfigService,
  );
  return { prisma, notifications, service };
}

describe('VendorsService', () => {
  it('refuses an application when the email already has an account', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.apply({
        firstName: 'A',
        lastName: 'B',
        email: 'Seller@Example.com',
        password: 'secret123',
        storeName: 'Shop',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'seller@example.com' } }),
    );
  });

  it('approves a pending vendor, sets approvedAt and emails the seller', async () => {
    const { prisma, notifications, service } = setup();
    prisma.vendor.findUnique
      .mockResolvedValueOnce(vendor())
      .mockResolvedValueOnce(vendor({ status: 'APPROVED' }));

    const result = await service.approve('v1', { commissionRate: 12.5 }, 'admin');

    const data = prisma.vendor.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'APPROVED', statusReason: null });
    expect(prisma.commissionRule.create).toHaveBeenCalledWith({
      data: { scope: 'VENDOR', vendorId: 'v1', rate: 12.5 },
    });
    expect(data.approvedAt).toBeInstanceOf(Date);
    expect(result.status).toBe('APPROVED');
    expect(notifications.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'vendor.approved' }),
    );
  });

  it('stores the reason when rejecting', async () => {
    const { prisma, service } = setup();
    prisma.vendor.findUnique.mockResolvedValue(vendor());

    await service.reject('v1', 'Business documents are missing', 'admin');

    expect(prisma.vendor.update.mock.calls[0][0].data).toMatchObject({
      status: 'REJECTED',
      statusReason: 'Business documents are missing',
    });
  });

  it('blocks invalid transitions (cannot suspend a pending vendor)', async () => {
    const { prisma, service } = setup();
    prisma.vendor.findUnique.mockResolvedValue(vendor({ status: 'PENDING' }));

    await expect(service.suspend('v1', 'Too many complaints')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.vendor.update).not.toHaveBeenCalled();
  });

  it('does not fail the decision when the email cannot be queued', async () => {
    const { prisma, notifications, service } = setup();
    prisma.vendor.findUnique.mockResolvedValue(vendor({ status: 'SUSPENDED' }));
    notifications.sendEmail.mockRejectedValue(new Error('redis down'));

    await expect(service.reactivate('v1')).resolves.toMatchObject({ status: 'APPROVED' });
  });
});
