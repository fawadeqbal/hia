import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AccessService } from '../access/access.service';
import { RolesGuard } from './roles.guard';

function ctx(user: object | undefined, method: string, url: string): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user, method, url, originalUrl: url }) }),
  } as unknown as ExecutionContext;
}

function guard(
  required: string[] | undefined,
  perms: string[] = [],
  staff: { vendorId: string; permissions: string[] } | null = null,
) {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const access = {
    permissionsForRoles: jest.fn().mockResolvedValue(new Set(perms)),
    vendorStaff: jest.fn().mockResolvedValue(staff),
  } as unknown as AccessService;
  return new RolesGuard(reflector, access);
}

describe('RolesGuard', () => {
  it('allows routes without @Roles and matching built-in roles', async () => {
    await expect(guard(undefined).canActivate(ctx(undefined, 'GET', '/api/v1/x'))).resolves.toBe(
      true,
    );
    await expect(
      guard(['ADMIN']).canActivate(ctx({ roles: ['ADMIN'] }, 'POST', '/api/v1/admin/orders')),
    ).resolves.toBe(true);
    await expect(
      guard(['ADMIN']).canActivate(ctx({ roles: ['SUPER_ADMIN'] }, 'POST', '/api/v1/admin/roles')),
    ).resolves.toBe(true);
  });

  it('lets a custom role view but not change an area it can only view', async () => {
    const g = guard(['ADMIN'], ['orders.view']);
    await expect(
      g.canActivate(ctx({ roles: ['ORDER_VIEWER'] }, 'GET', '/api/v1/admin/orders?page=2')),
    ).resolves.toBe(true);
    await expect(
      g.canActivate(ctx({ roles: ['ORDER_VIEWER'] }, 'POST', '/api/v1/admin/orders/1/cancel')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      g.canActivate(ctx({ roles: ['ORDER_VIEWER'] }, 'GET', '/api/v1/admin/customers')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('manage includes view', async () => {
    const g = guard(['ADMIN'], ['catalog.manage']);
    await expect(
      g.canActivate(ctx({ roles: ['CATALOG_EDITOR'] }, 'GET', '/api/v1/admin/catalog/brands')),
    ).resolves.toBe(true);
    await expect(
      g.canActivate(ctx({ roles: ['CATALOG_EDITOR'] }, 'POST', '/api/v1/admin/products/1/approve')),
    ).resolves.toBe(true);
  });

  it('seller staff only reach the store areas they were given', async () => {
    const g = guard(['VENDOR'], [], { vendorId: 'v1', permissions: ['orders'] });
    const user = { sub: 'u1', roles: ['VENDOR_STAFF'] };
    await expect(g.canActivate(ctx(user, 'POST', '/api/v1/vendor/orders/1/status'))).resolves.toBe(
      true,
    );
    await expect(g.canActivate(ctx(user, 'GET', '/api/v1/vendor/me'))).resolves.toBe(true);
    await expect(g.canActivate(ctx(user, 'PATCH', '/api/v1/vendor/me'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(g.canActivate(ctx(user, 'GET', '/api/v1/vendor/products'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(g.canActivate(ctx(user, 'POST', '/api/v1/vendor/staff'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
