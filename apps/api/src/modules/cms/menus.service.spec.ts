import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { MenusService } from './menus.service';

function setup() {
  let id = 0;
  const tx = {
    menuItem: {
      deleteMany: jest.fn(),
      create: jest.fn().mockImplementation(() => Promise.resolve({ id: `i${++id}` })),
    },
  };
  const prisma = {
    menu: {
      upsert: jest.fn().mockResolvedValue({ id: 'm1', name: 'Header menu', handle: 'header' }),
    },
    menuItem: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const audit = { log: jest.fn() };
  const service = new MenusService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { prisma, tx, audit, service };
}

describe('MenusService', () => {
  it('rejects unknown menu handles', async () => {
    const { service } = setup();
    await expect(service.get('sidebar')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replaces all items in one transaction, keeping order and children', async () => {
    const { tx, prisma, audit, service } = setup();
    await service.save(
      'footer',
      {
        items: [
          {
            label: 'Help',
            url: '/faq',
            children: [
              { label: 'FAQ', url: '/faq' },
              { label: 'Returns', url: '/pages/return-policy' },
            ],
          },
          { label: 'Shop', url: '/products' },
        ],
      },
      'admin',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.menuItem.deleteMany).toHaveBeenCalled();
    const created = tx.menuItem.create.mock.calls.map((c) => c[0].data);
    expect(created.map((d: { label: string }) => d.label)).toEqual([
      'Help',
      'FAQ',
      'Returns',
      'Shop',
    ]);
    expect(created[1]).toEqual(expect.objectContaining({ parentId: 'i1', position: 0 }));
    expect(created[3]).toEqual(expect.objectContaining({ position: 1 }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'cms.menu.save' }));
  });
});
