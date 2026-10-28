import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { AccountService } from './account.service';
import type { UsersService } from './users.service';

function setup(userOver: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        email: 'sara@example.com',
        firstName: 'Sara',
        passwordHash: null,
        roles: [{ role: { name: 'CUSTOMER' } }],
        ownedVendors: [],
        ...userOver,
      }),
      update: jest.fn(),
    },
    order: { count: jest.fn().mockResolvedValue(0) },
    address: { deleteMany: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    emailPreference: { updateMany: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const notifications = { sendEmail: jest.fn() };
  const service = new AccountService(
    prisma as unknown as PrismaService,
    {} as UsersService,
    notifications as unknown as NotificationsService,
    { get: (_k: string, f: unknown) => f } as unknown as ConfigService,
  );
  return { prisma, notifications, service };
}

describe('AccountService.deleteAccount', () => {
  it('blocks deletion while orders are in progress', async () => {
    const { prisma, service } = setup();
    prisma.order.count.mockResolvedValue(2);
    await expect(service.deleteAccount('u1', { confirm: 'DELETE' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks seller and staff accounts', async () => {
    const { service } = setup({ roles: [{ role: { name: 'VENDOR' } }] });
    await expect(service.deleteAccount('u1', { confirm: 'DELETE' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('requires the password when the account has one', async () => {
    const { service } = setup({ passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$abc$def' });
    await expect(service.deleteAccount('u1', { confirm: 'DELETE' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('anonymises the user and emails the original address', async () => {
    const { prisma, notifications, service } = setup();
    await service.deleteAccount('u1', { confirm: 'DELETE' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DELETED',
          email: 'deleted-u1@deleted.invalid',
          passwordHash: null,
        }),
      }),
    );
    expect(notifications.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'sara@example.com' }),
    );
  });
});
