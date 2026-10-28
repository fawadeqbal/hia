import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import { BrandsService } from './brands.service';

const now = new Date('2026-01-01T00:00:00Z');
const brand = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  name: 'Samsung',
  slug: 'samsung',
  logoUrl: null,
  description: null,
  isActive: true,
  createdAt: now,
  ...over,
});

function setup() {
  const prisma = {
    brand: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  const service = new BrandsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { prisma, audit, service };
}

describe('BrandsService', () => {
  it('generates a slug from the name and audits the create', async () => {
    const { prisma, audit, service } = setup();
    prisma.brand.findFirst.mockResolvedValue(null);
    prisma.brand.create.mockImplementation(({ data }) => Promise.resolve(brand(data)));

    const result = await service.create({ name: 'Bang & Olufsen' });

    expect(result.slug).toBe('bang-olufsen');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'catalog.brand.create' }),
    );
  });

  it('keeps the slug when it is unchanged on update', async () => {
    const { prisma, service } = setup();
    prisma.brand.findUnique.mockResolvedValue(brand());
    prisma.brand.update.mockImplementation(({ data }) =>
      Promise.resolve(brand({ ...data, slug: 'samsung' })),
    );

    await service.update('b1', { slug: 'samsung', name: 'Samsung Electronics' });

    expect(prisma.brand.findFirst).not.toHaveBeenCalled();
    expect(prisma.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: undefined }) }),
    );
  });

  it('refuses to delete a brand that has products', async () => {
    const { prisma, service } = setup();
    prisma.brand.findUnique.mockResolvedValue({ ...brand(), _count: { products: 4 } });

    await expect(service.remove('b1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.brand.delete).not.toHaveBeenCalled();
  });

  it('throws NotFound for an unknown brand', async () => {
    const { prisma, service } = setup();
    prisma.brand.findUnique.mockResolvedValue(null);

    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
