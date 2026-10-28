import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import {
  EmailTemplateKey,
  STAFF_ROLES,
  type EmailPreferencesDto,
  type Role,
} from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  ChangePasswordDto,
  DeleteAccountDto,
  EmailPreferencesBody,
  UpdateProfileDto,
} from './dto/account.dto';
import { UsersService } from './users.service';

/** Orders in these states are finished; anything else blocks account deletion. */
const FINISHED_ORDER_STATUSES = ['DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'] as const;

/** Customer self-service: profile, password, email preferences, account deletion. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Awaited<ReturnType<UsersService['me']>>> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone?.trim() || null },
    });
    return this.users.me(userId);
  }

  /** Keeps the current session (cookie) signed in and signs every other device out. */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentRefreshToken?: string,
  ): Promise<void> {
    const user = await this.findUser(userId);
    if (user.passwordHash) {
      if (!dto.currentPassword || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
        throw new BadRequestException('Current password is incorrect');
      }
    }
    const keep = currentRefreshToken
      ? createHash('sha256').update(currentRefreshToken).digest('hex')
      : null;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await argon2.hash(dto.newPassword) },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null, ...(keep ? { NOT: { tokenHash: keep } } : {}) },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.email(EmailTemplateKey.PASSWORD_CHANGED, user.email, userId, {
      heading: 'Your password was changed',
      body: `Hi ${user.firstName}, the password for your account was just changed. If this wasn't you, reset it now.`,
      ctaLabel: 'Reset password',
      ctaUrl: `${this.siteUrl()}/forgot-password`,
    });
  }

  async emailPreferences(userId: string): Promise<EmailPreferencesDto> {
    const pref = await this.prisma.emailPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return { marketing: pref.marketing, productUpdates: pref.productUpdates };
  }

  async saveEmailPreferences(
    userId: string,
    dto: EmailPreferencesBody,
  ): Promise<EmailPreferencesDto> {
    const unsubscribedAt = !dto.marketing && !dto.productUpdates ? new Date() : null;
    const pref = await this.prisma.emailPreference.upsert({
      where: { userId },
      update: { marketing: dto.marketing, productUpdates: dto.productUpdates, unsubscribedAt },
      create: {
        userId,
        marketing: dto.marketing,
        productUpdates: dto.productUpdates,
        unsubscribedAt,
      },
    });
    return { marketing: pref.marketing, productUpdates: pref.productUpdates };
  }

  /**
   * Deletes a customer account: personal data is anonymised, addresses removed, sessions revoked.
   * Orders stay (accounting) but are no longer linked to a person. Blocked while orders are open.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        ownedVendors: { select: { id: true }, take: 1 },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (
      user.passwordHash &&
      (!dto.password || !(await argon2.verify(user.passwordHash, dto.password)))
    ) {
      throw new BadRequestException('Password is incorrect');
    }
    const roles = user.roles.map((r) => r.role.name as Role);
    if (
      user.ownedVendors.length > 0 ||
      roles.some((r) => STAFF_ROLES.includes(r) || r === 'VENDOR' || r === 'VENDOR_STAFF')
    ) {
      throw new ConflictException(
        'Seller and staff accounts are closed by an administrator. Please contact support.',
      );
    }
    const open = await this.prisma.order.count({
      where: { userId, status: { notIn: [...FINISHED_ORDER_STATUSES] } },
    });
    if (open > 0) {
      throw new ConflictException(
        `You have ${open} order${open === 1 ? '' : 's'} in progress. Try again once they are delivered or cancelled.`,
      );
    }

    const originalEmail = user.email;
    const firstName = user.firstName;
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.address.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.emailPreference.updateMany({
        where: { userId },
        data: { marketing: false, productUpdates: false, unsubscribedAt: now },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          deletedAt: now,
          email: `deleted-${userId}@deleted.invalid`,
          firstName: 'Deleted',
          lastName: 'user',
          phone: null,
          avatarUrl: null,
          passwordHash: null,
          googleId: null,
        },
      }),
    ]);
    await this.email(EmailTemplateKey.ACCOUNT_DELETED, originalEmail, undefined, {
      heading: 'Your account has been deleted',
      body: `Hi ${firstName}, your account and personal details have been removed. Thank you for shopping with us.`,
    });
  }

  private async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async email(
    template: EmailTemplateKey,
    to: string,
    userId: string | undefined,
    data: Record<string, unknown>,
  ) {
    try {
      await this.notifications.sendEmail({ template, to, userId, data });
    } catch (error) {
      this.logger.error(`Could not queue ${template}: ${String(error)}`);
    }
  }

  private siteUrl() {
    return this.config
      .get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
  }
}
