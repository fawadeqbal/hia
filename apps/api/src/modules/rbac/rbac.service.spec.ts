import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AccessService } from '../../common/access/access.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { AuthService } from '../auth/auth.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { RbacService } from './rbac.service';

function setup() {
  const prisma = {
    user: { findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    role: { findMany: jest.fn(), findUnique: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const service = new RbacService(
    prisma as unknown as PrismaService,
    { log: jest.fn() } as unknown as AuditService,
    { invalidate: jest.fn(), permissionsForRoles: jest.fn() } as unknown as AccessService,
    {} as AuthService,
    {} as NotificationsService,
    { get: (_k: string, f: unknown) => f } as unknown as ConfigService,
  );
  return { prisma, service };
}

describe('RbacService safety rules', () => {
  it("you can't change your own roles or deactivate yourself", async () => {
    const { service } = setup();
    await expect(
      service.updateStaffRoles('me', ['r1'], { sub: 'me', roles: ['SUPER_ADMIN'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setStaffActive('me', false, 'me')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('keeps at least one active super admin', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({
      id: 'u2',
      roles: [{ role: { id: 'sa', name: 'SUPER_ADMIN' } }],
    });
    prisma.user.count.mockResolvedValue(0);
    await expect(service.setStaffActive('u2', false, 'u1')).rejects.toThrow(
      'at least one active super admin',
    );
  });

  it('only a super admin can grant super admin, and customer roles are not grantable', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({
      id: 'u2',
      roles: [{ role: { id: 'cm', name: 'CONTENT_MANAGER' } }],
    });
    prisma.role.findMany.mockResolvedValueOnce([{ id: 'sa', name: 'SUPER_ADMIN' }]);
    await expect(
      service.updateStaffRoles('u2', ['sa'], { sub: 'u1', roles: ['CUSTOM_ADMIN'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.role.findMany.mockResolvedValueOnce([{ id: 'c', name: 'CUSTOMER' }]);
    await expect(
      service.updateStaffRoles('u2', ['c'], { sub: 'u1', roles: ['SUPER_ADMIN'] }),
    ).rejects.toThrow('not staff roles');
  });
});
