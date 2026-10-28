import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../prisma/prisma.service';
import type { LoyaltyService } from '../loyalty/loyalty.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { hashSecret } from './auth-tokens';
import { AuthService } from './auth.service';

const SECRET = 'x'.repeat(40);
const user = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'sara@example.com',
  firstName: 'Sara',
  status: 'ACTIVE',
  emailVerifiedAt: null,
  passwordHash: 'hash',
  ...over,
});

function setup() {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
    otpCode: { updateMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    refreshToken: { updateMany: jest.fn(), create: jest.fn() },
    session: {
      create: jest.fn().mockResolvedValue({ id: 's1' }),
      update: jest.fn().mockResolvedValue({ id: 's1' }),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const notifications = { sendEmail: jest.fn() };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === 'GOOGLE_CLIENT_ID' ? undefined : fallback,
    ),
    getOrThrow: jest.fn(() => SECRET),
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    { signAsync: jest.fn().mockResolvedValue('jwt') } as unknown as JwtService,
    config as unknown as ConfigService,
    notifications as unknown as NotificationsService,
    { onRegister: jest.fn() } as unknown as LoyaltyService,
  );
  return { prisma, notifications, service };
}

describe('AuthService account flows', () => {
  it('forgot-password is silent for unknown emails (no account discovery)', async () => {
    const { prisma, notifications, service } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
    expect(notifications.sendEmail).not.toHaveBeenCalled();
  });

  it('forgot-password stores only a hash and emails a reset link', async () => {
    const { prisma, notifications, service } = setup();
    prisma.user.findUnique.mockResolvedValue(user());
    await service.forgotPassword('Sara@Example.com');
    const stored = prisma.otpCode.create.mock.calls[0][0].data;
    expect(stored.purpose).toBe('PASSWORD_RESET');
    const link = notifications.sendEmail.mock.calls[0][0].data.resetUrl as string;
    const token = new URL(link).searchParams.get('token') as string;
    expect(stored.codeHash).toBe(hashSecret(token, SECRET));
    expect(stored.codeHash).not.toContain(token);
  });

  it('rejects an expired or unknown reset token', async () => {
    const { prisma, service } = setup();
    prisma.otpCode.findFirst.mockResolvedValue(null);
    await expect(service.resetPassword('t'.repeat(43), 'new-password')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('counts wrong OTP attempts and locks after the maximum', async () => {
    const { prisma, service } = setup();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      attempts: 0,
      codeHash: hashSecret('sara@example.com:111111', SECRET),
    });
    await expect(service.verifyOtp('sara@example.com', '222222')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { attempts: { increment: 1 } },
    });

    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      attempts: 5,
      codeHash: hashSecret('sara@example.com:111111', SECRET),
    });
    await expect(service.verifyOtp('sara@example.com', '111111')).rejects.toThrow(
      'Too many attempts',
    );
  });

  it('a correct OTP signs in and verifies the email', async () => {
    const { prisma, service } = setup();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      attempts: 0,
      codeHash: hashSecret('sara@example.com:123456', SECRET),
    });
    prisma.user.findUnique.mockResolvedValue(user({ status: 'PENDING_VERIFICATION' }));
    prisma.user.findUniqueOrThrow.mockResolvedValue({ ...user(), roles: [], ownedVendors: [] });
    const tokens = await service.verifyOtp('sara@example.com', '123456');
    expect(tokens.accessToken).toBe('jwt');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', emailVerifiedAt: expect.any(Date) }),
      }),
    );
  });

  it('Google is offered only when configured', () => {
    const { service } = setup();
    expect(service.providers()).toEqual({ google: false });
  });
});
