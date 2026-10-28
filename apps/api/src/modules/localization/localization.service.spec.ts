import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { LocalizationService } from './localization.service';

const usd = {
  code: 'USD',
  name: 'US Dollar',
  symbol: '$',
  exchangeRate: 1,
  isDefault: true,
  isActive: true,
};
const pkr = {
  code: 'PKR',
  name: 'Rupee',
  symbol: 'Rs',
  exchangeRate: 280,
  isDefault: false,
  isActive: true,
};

function setup() {
  const prisma = {
    currency: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    language: { findUnique: jest.fn(), delete: jest.fn() },
    order: { count: jest.fn() },
    product: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn() };
  return {
    prisma,
    service: new LocalizationService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    ),
  };
}

describe('LocalizationService', () => {
  it('keeps the store currency active and at rate 1', async () => {
    const { prisma, service } = setup();
    prisma.currency.findUnique.mockResolvedValue(usd);
    await expect(
      service.updateCurrency('USD', {
        name: 'Dollar',
        symbol: '$',
        exchangeRate: 3,
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.currency.update.mockImplementation(({ data }) => Promise.resolve({ ...usd, ...data }));
    const r = await service.updateCurrency('USD', {
      name: 'Dollar',
      symbol: '$',
      exchangeRate: 3,
      isActive: true,
    });
    expect(prisma.currency.update.mock.calls[0][0].data.exchangeRate).toBe(1);
    expect(r.exchangeRate).toBe(1);
  });

  it('refuses to change the store currency after the first order', async () => {
    const { prisma, service } = setup();
    prisma.currency.findUnique.mockResolvedValue(pkr);
    prisma.order.count.mockResolvedValue(3);
    await expect(service.makeDefaultCurrency('PKR')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('re-bases rates when the store currency changes before any order', async () => {
    const { prisma, service } = setup();
    prisma.currency.findUnique.mockResolvedValue(pkr);
    prisma.order.count.mockResolvedValue(0);
    prisma.currency.findMany.mockResolvedValue([usd, pkr]);
    prisma.currency.update.mockImplementation((args) => args);
    await service.makeDefaultCurrency('PKR');
    const updates = prisma.currency.update.mock.calls.map((c) => c[0]);
    expect(updates.find((u) => u.where.code === 'PKR').data).toMatchObject({
      isDefault: true,
      exchangeRate: 1,
    });
    expect(updates.find((u) => u.where.code === 'USD').data.exchangeRate).toBeCloseTo(1 / 280, 6);
  });

  it('protects the default language', async () => {
    const { prisma, service } = setup();
    prisma.language.findUnique.mockResolvedValue({
      code: 'en',
      name: 'English',
      isDefault: true,
      isActive: true,
      isRtl: false,
    });
    await expect(service.removeLanguage('en')).rejects.toBeInstanceOf(BadRequestException);
  });
});
