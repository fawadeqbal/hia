import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import { AttributesService } from './attributes.service';

const value = (id: string, v: string, used = 0) => ({
  id,
  attributeId: 'a1',
  value: v,
  label: v.toUpperCase(),
  swatch: null,
  position: 0,
  _count: { variants: used },
});

const attribute = (values: ReturnType<typeof value>[] = []) => ({
  id: 'a1',
  name: 'Size',
  code: 'size',
  type: 'select',
  isFilterable: true,
  position: 0,
  values,
});

function setup() {
  const tx = {
    attribute: { update: jest.fn() },
    attributeValue: { deleteMany: jest.fn(), update: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    attribute: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const audit = { log: jest.fn() };
  const service = new AttributesService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { prisma, tx, service };
}

describe('AttributesService', () => {
  it('rejects duplicate value keys', async () => {
    const { service } = setup();
    await expect(
      service.create({ name: 'Size', values: [{ value: 'xl' }, { value: 'xl' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates values with positions from their order', async () => {
    const { prisma, service } = setup();
    prisma.attribute.create.mockResolvedValue(attribute([value('v1', 's'), value('v2', 'm')]));

    await service.create({
      name: 'Size',
      values: [
        { value: 's', label: 'S' },
        { value: 'm', label: 'M' },
      ],
    });

    const data = prisma.attribute.create.mock.calls[0][0].data;
    expect(data.code).toBe('size');
    expect(data.values.create).toEqual([
      { value: 's', label: 'S', swatch: null, position: 0 },
      { value: 'm', label: 'M', swatch: null, position: 1 },
    ]);
  });

  it('refuses to remove a value that variants use', async () => {
    const { prisma, service } = setup();
    prisma.attribute.findUnique.mockResolvedValue(
      attribute([value('v1', 's', 3), value('v2', 'm')]),
    );

    await expect(
      service.update('a1', { values: [{ id: 'v2', value: 'm' }] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('syncs values: deletes removed, renames safely, creates new', async () => {
    const { prisma, tx, service } = setup();
    const current = attribute([value('v1', 's'), value('v2', 'm')]);
    prisma.attribute.findUnique.mockResolvedValue(current);

    await service.update('a1', {
      values: [
        { id: 'v2', value: 's' }, // rename m -> s (swap-safe)
        { value: 'l', label: 'L' },
      ],
    });

    expect(tx.attributeValue.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['v1'] } } });
    expect(tx.attributeValue.update).toHaveBeenCalledWith({
      where: { id: 'v2' },
      data: { value: '__tmp__v2' },
    });
    expect(tx.attributeValue.create).toHaveBeenCalledWith({
      data: { value: 'l', label: 'L', swatch: null, position: 1, attributeId: 'a1' },
    });
  });

  it('refuses to delete an attribute in use', async () => {
    const { prisma, service } = setup();
    prisma.attribute.findUnique.mockResolvedValue(attribute([value('v1', 's', 2)]));

    await expect(service.remove('a1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.attribute.delete).not.toHaveBeenCalled();
  });
});
