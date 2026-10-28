import type { PrismaService } from '../../prisma/prisma.service';
import { DiscoveryService } from './discovery.service';

function setup() {
  const prisma = {
    product: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
    productView: { findFirst: jest.fn(), create: jest.fn() },
  };
  return { prisma, service: new DiscoveryService(prisma as unknown as PrismaService) };
}

describe('DiscoveryService.recordView', () => {
  it('ignores anonymous calls without a session id', async () => {
    const { prisma, service } = setup();
    await service.recordView('phone', undefined, undefined);
    expect(prisma.productView.create).not.toHaveBeenCalled();
  });

  it('records one view per visitor per 30 minutes', async () => {
    const { prisma, service } = setup();
    prisma.productView.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'v1' });
    await service.recordView('phone', undefined, 'visitor-1234');
    await service.recordView('phone', undefined, 'visitor-1234');
    expect(prisma.productView.create).toHaveBeenCalledTimes(1);
    expect(prisma.productView.create).toHaveBeenCalledWith({
      data: { productId: 'p1', userId: null, sessionId: 'visitor-1234' },
    });
  });
});
