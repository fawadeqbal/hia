import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function context(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guard(isPublic: boolean, verify: jest.Mock) {
  return new JwtAuthGuard(
    { verifyAsync: verify } as unknown as JwtService,
    { getAllAndOverride: () => isPublic } as unknown as Reflector,
    { getOrThrow: () => 'secret' } as unknown as ConfigService,
  );
}

describe('JwtAuthGuard', () => {
  it('attaches the user on public routes when a valid token is present', async () => {
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good' } };
    await expect(
      guard(true, jest.fn().mockResolvedValue({ sub: 'u1' })).canActivate(context(req)),
    ).resolves.toBe(true);
    expect(req.user).toEqual({ sub: 'u1' });
  });

  it('lets guests through public routes even with a bad token', async () => {
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer bad' } };
    await expect(
      guard(true, jest.fn().mockRejectedValue(new Error('x'))).canActivate(context(req)),
    ).resolves.toBe(true);
    expect(req.user).toBeUndefined();
  });

  it('rejects protected routes without a token', async () => {
    await expect(
      guard(false, jest.fn()).canActivate(context({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
