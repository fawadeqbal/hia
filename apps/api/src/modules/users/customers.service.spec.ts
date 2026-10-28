import { BadRequestException } from '@nestjs/common';
import { DEFAULT_SEGMENT_RULES, segmentsFor } from '@ecommerce/types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { CustomersService } from './customers.service';

const now = new Date('2026-10-12T00:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe('segmentsFor', () => {
  it('tags a brand-new customer as new (and not yet inactive)', () => {
    expect(
      segmentsFor(
        { createdAt: daysAgo(3), orders: 0, spent: 0, lastOrderAt: null },
        DEFAULT_SEGMENT_RULES,
        now,
      ),
    ).toEqual(['new']);
  });

  it('tags repeat, high-value and inactive customers', () => {
    expect(
      segmentsFor(
        { createdAt: daysAgo(400), orders: 5, spent: 900, lastOrderAt: daysAgo(120) },
        DEFAULT_SEGMENT_RULES,
        now,
      ),
    ).toEqual(['repeat', 'high_value', 'inactive']);
  });

  it('someone who joined long ago and never ordered is inactive', () => {
    expect(
      segmentsFor(
        { createdAt: daysAgo(100), orders: 0, spent: 0, lastOrderAt: null },
        DEFAULT_SEGMENT_RULES,
        now,
      ),
    ).toEqual(['inactive']);
  });
});

describe('CustomersService.block', () => {
  function setup(status = 'ACTIVE') {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', status, emailVerifiedAt: now }),
        update: jest.fn(),
      },
      refreshToken: { updateMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const audit = { log: jest.fn() };
    const service = new CustomersService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
    jest.spyOn(service, 'get').mockResolvedValue({} as never);
    return { prisma, audit, service };
  }

  it('blocks, revokes sessions and records the reason', async () => {
    const { prisma, audit, service } = setup();
    await service.block('c1', 'Fraudulent orders', 'admin');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'BLOCKED' },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'customers.block',
        after: { status: 'BLOCKED', reason: 'Fraudulent orders' },
      }),
    );
  });

  it('refuses to block twice or to block yourself', async () => {
    await expect(
      setup('BLOCKED').service.block('c1', 'Again please', 'admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup().service.block('c1', 'Myself here', 'c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('unblocking restores ACTIVE for verified customers', async () => {
    const { prisma, service } = setup('BLOCKED');
    await service.unblock('c1', 'admin');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'ACTIVE' },
    });
  });
});
