import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import { CategoriesService } from './categories.service';

const now = new Date('2026-01-01T00:00:00Z');
const category = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  parentId: null,
  name: 'Phones',
  slug: 'phones',
  description: null,
  imageUrl: null,
  position: 0,
  isActive: true,
  seoTitle: null,
  seoDescription: null,
  createdAt: now,
  updatedAt: now,
  ...over,
});

function setup() {
  const prisma = {
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  const service = new CategoriesService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { prisma, audit, service };
}

describe('CategoriesService', () => {
  it('adds a numeric suffix when the generated slug is taken', async () => {
    const { prisma, service } = setup();
    prisma.category.findFirst.mockResolvedValueOnce({ id: 'other' }).mockResolvedValueOnce(null);
    prisma.category.create.mockImplementation(({ data }) => Promise.resolve(category(data)));

    const result = await service.create({ name: 'Phones' });

    expect(result.slug).toBe('phones-2');
  });

  it('rejects an explicit slug that is already used', async () => {
    const { prisma, service } = setup();
    prisma.category.findFirst.mockResolvedValue({ id: 'other' });

    await expect(service.create({ name: 'Phones', slug: 'phones' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses to move a category under its own child', async () => {
    const { prisma, service } = setup();
    prisma.category.findUnique
      .mockResolvedValueOnce(category({ id: 'parent' })) // existing
      .mockResolvedValueOnce({ parentId: 'parent' }); // child -> parent

    await expect(service.update('parent', { parentId: 'child' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to delete a category that has subcategories', async () => {
    const { prisma, service } = setup();
    prisma.category.findUnique.mockResolvedValue({
      ...category(),
      _count: { products: 0, children: 2 },
    });

    await expect(service.remove('c1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });

  it('returns the list as a depth-first tree', async () => {
    const { prisma, service } = setup();
    prisma.category.findMany.mockResolvedValue([
      { ...category({ id: 'root', name: 'Electronics' }), _count: { products: 0, children: 1 } },
      {
        ...category({ id: 'child', parentId: 'root', name: 'Phones' }),
        _count: { products: 3, children: 0 },
      },
    ]);

    const list = await service.list();

    expect(list.map((c) => [c.name, c.depth, c.parentName])).toEqual([
      ['Electronics', 0, null],
      ['Phones', 1, 'Electronics'],
    ]);
  });
});
