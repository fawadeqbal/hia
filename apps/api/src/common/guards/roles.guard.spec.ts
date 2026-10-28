import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function ctx(user: object | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const guard = (required: string[] | undefined) =>
  new RolesGuard({ getAllAndOverride: () => required } as unknown as Reflector);

describe('RolesGuard', () => {
  it('allows routes without @Roles', () => {
    expect(guard(undefined).canActivate(ctx(undefined))).toBe(true);
  });

  it('allows a matching role', () => {
    expect(guard(['ADMIN']).canActivate(ctx({ roles: ['ADMIN'] }))).toBe(true);
  });

  it('lets the super admin (shop owner) into every route, including the store routes', () => {
    expect(guard(['VENDOR']).canActivate(ctx({ roles: ['SUPER_ADMIN'] }))).toBe(true);
    expect(guard(['ADMIN']).canActivate(ctx({ roles: ['SUPER_ADMIN'] }))).toBe(true);
  });

  it('refuses customers and guests', () => {
    expect(() => guard(['ADMIN']).canActivate(ctx({ roles: ['CUSTOMER'] }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard(['VENDOR']).canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
