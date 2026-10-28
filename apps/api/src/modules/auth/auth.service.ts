import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { OtpPurpose, Prisma, User } from '@ecommerce/database';
import {
  EmailTemplateKey,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
  Role,
  VERIFY_EMAIL_TTL_HOURS,
  type AuthProviders,
  type AuthTokens,
  type DeviceSession,
  type EmailJobPayload,
  type JwtPayload,
} from '@ecommerce/types';
import { markSessionsRevoked } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { hashSecret, newOtp, newToken } from './auth-tokens';
import type { LoginDto, RegisterDto } from './dto/auth.dto';
import { googleAuthUrl, googleProfileFromCode, type GoogleProfile } from './google-oauth';

const MINUTE = 60_000;
const INACTIVE = ['BLOCKED', 'DELETED'];

/**
 * AuthService — email + password, email one-time codes, Google OAuth, email verification,
 * password reset, rotating refresh tokens. Codes/tokens are stored hashed and single-use.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly loyalty: LoyaltyService,
  ) {}

  // ================================================================ password sign-up / sign-in

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email is already registered');

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: await argon2.hash(dto.password),
        roles: { create: { role: { connect: { name: Role.CUSTOMER } } } },
        emailPreference: { create: {} },
      },
    });

    await this.email({
      template: EmailTemplateKey.WELCOME,
      to: user.email,
      userId: user.id,
      data: { firstName: user.firstName },
    });
    await this.sendVerification(user.id);
    await this.loyalty.onRegister(user.id, dto.referralCode);
    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException(
        user && !user.passwordHash
          ? 'This account has no password yet — sign in with an email code or Google'
          : 'Invalid email or password',
      );
    }
    this.assertActive(user);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
      include: { session: { select: { revokedAt: true } } },
    });
    if (!record || record.expiresAt < new Date() || record.session?.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (record.revokedAt) {
      // A rotated token was used again: likely stolen. End that whole device session.
      if (record.sessionId) await this.endSessions({ id: record.sessionId });
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(record.userId, record.sessionId ?? undefined);
  }

  async logout(refreshToken: string): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
      select: { id: true, sessionId: true },
    });
    if (!record) return;
    if (record.sessionId) await this.endSessions({ id: record.sessionId });
    else
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
  }

  // ================================================================ device sessions

  /** Records which device a freshly issued token pair belongs to. */
  async tagSession(refreshToken: string, userAgent?: string, ip?: string): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
      select: { sessionId: true },
    });
    if (!record?.sessionId) return;
    await this.prisma.session.update({
      where: { id: record.sessionId },
      data: { userAgent: userAgent?.slice(0, 400) || undefined, ip: ip || undefined },
    });
  }

  async listSessions(userId: string, currentSid?: string): Promise<DeviceSession[]> {
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt.toISOString(),
      current: r.id === currentSid,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.endSessions({ id: sessionId, userId });
  }

  /** Signs out every device except the current one. */
  async revokeOtherSessions(userId: string, currentSid?: string): Promise<void> {
    await this.endSessions({ userId, ...(currentSid ? { id: { not: currentSid } } : {}) });
  }

  private async endSessions(where: Prisma.SessionWhereInput): Promise<void> {
    const now = new Date();
    const sessions = await this.prisma.session.findMany({
      where: { ...where, revokedAt: null },
      select: { id: true },
    });
    if (sessions.length === 0) return;
    const ids = sessions.map((x) => x.id);
    markSessionsRevoked(ids);
    await this.prisma.$transaction([
      this.prisma.session.updateMany({ where: { id: { in: ids } }, data: { revokedAt: now } }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId: { in: ids }, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  // ================================================================ email verification

  /** Sends (or re-sends) the verification link. No-op for verified accounts. */
  async sendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerifiedAt) return;
    const token = newToken();
    await this.storeCode(user, 'VERIFY_EMAIL', token, VERIFY_EMAIL_TTL_HOURS * 60 * MINUTE);
    await this.email({
      template: EmailTemplateKey.VERIFY_EMAIL,
      to: user.email,
      userId: user.id,
      data: {
        firstName: user.firstName,
        verifyUrl: `${this.siteUrl()}/verify-email?token=${token}`,
      },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const code = await this.findLiveCode('VERIFY_EMAIL', this.pepper(token));
    if (!code?.userId) throw new BadRequestException('This link is invalid or has expired');
    const user = await this.prisma.user.findUnique({ where: { id: code.userId } });
    if (!user) throw new BadRequestException('This link is invalid or has expired');
    await this.prisma.$transaction([
      this.prisma.otpCode.update({ where: { id: code.id }, data: { consumedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : undefined,
        },
      }),
    ]);
  }

  // ================================================================ password reset

  /** Always succeeds from the caller's point of view, so it can't be used to discover accounts. */
  async forgotPassword(emailAddress: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: emailAddress.toLowerCase() },
    });
    if (!user || INACTIVE.includes(user.status)) return;
    const token = newToken();
    await this.storeCode(user, 'PASSWORD_RESET', token, PASSWORD_RESET_TTL_MINUTES * MINUTE);
    await this.email({
      template: EmailTemplateKey.PASSWORD_RESET,
      to: user.email,
      userId: user.id,
      data: {
        firstName: user.firstName,
        resetUrl: `${this.siteUrl()}/reset-password?token=${token}`,
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      },
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const code = await this.findLiveCode('PASSWORD_RESET', this.pepper(token));
    if (!code?.userId)
      throw new BadRequestException('This link is invalid or has expired. Request a new one.');
    const user = await this.prisma.user.findUnique({ where: { id: code.userId } });
    if (!user || INACTIVE.includes(user.status))
      throw new BadRequestException('This link is invalid or has expired');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.otpCode.update({ where: { id: code.id }, data: { consumedAt: now } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await argon2.hash(password),
          // Clicking the emailed link proves the address.
          emailVerifiedAt: user.emailVerifiedAt ?? now,
          status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : undefined,
        },
      }),
      // Sign out everywhere: a reset usually means the old password leaked.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    markSessionsRevoked(
      (await this.prisma.session.findMany({ where: { userId: user.id }, select: { id: true } })).map(
        (x) => x.id,
      ),
    );
    await this.passwordChangedEmail(user);
  }

  /** Link for invited staff to choose their first password (72 hours). */
  async passwordSetupUrl(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const token = newToken();
    await this.storeCode(user, 'PASSWORD_RESET', token, 72 * 60 * MINUTE);
    return `${this.siteUrl()}/reset-password?token=${token}`;
  }

  // ================================================================ email one-time code

  /** Sends a 6-digit sign-in code to existing, active accounts. Silent otherwise. */
  async requestOtp(emailAddress: string): Promise<void> {
    const email = emailAddress.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || INACTIVE.includes(user.status)) return;
    const code = newOtp();
    await this.storeCode(user, 'LOGIN', `${email}:${code}`, OTP_TTL_MINUTES * MINUTE);
    await this.email({
      template: EmailTemplateKey.LOGIN_OTP,
      to: user.email,
      userId: user.id,
      data: { code, expiresInMinutes: OTP_TTL_MINUTES },
    });
  }

  async verifyOtp(emailAddress: string, code: string): Promise<AuthTokens> {
    const email = emailAddress.toLowerCase();
    const record = await this.prisma.otpCode.findFirst({
      where: { email, purpose: 'LOGIN', consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record)
      throw new UnauthorizedException('The code is invalid or has expired. Request a new one.');
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many attempts. Request a new code.');
    }
    if (record.codeHash !== this.pepper(`${email}:${code}`)) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Incorrect code');
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('The code is invalid or has expired');
    this.assertActive(user);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: now } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: now,
          emailVerifiedAt: user.emailVerifiedAt ?? now,
          status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : undefined,
        },
      }),
    ]);
    return this.issueTokens(user.id);
  }

  // ================================================================ Google

  providers(): AuthProviders {
    return { google: this.googleConfig() !== null };
  }

  googleStartUrl(state: string): string {
    const cfg = this.googleConfig();
    if (!cfg) throw new NotFoundException('Google sign-in is not configured');
    return googleAuthUrl(cfg.clientId, cfg.redirectUri, state);
  }

  async googleCallback(code: string): Promise<AuthTokens> {
    const cfg = this.googleConfig();
    if (!cfg) throw new NotFoundException('Google sign-in is not configured');
    const profile = await googleProfileFromCode(
      code,
      cfg.clientId,
      cfg.clientSecret,
      cfg.redirectUri,
    );
    const user = await this.findOrCreateGoogleUser(profile);
    this.assertActive(user);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user.id);
  }

  /** Match by Google id, then by verified email (links the accounts), else create a customer. */
  async findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
    const byGoogle = await this.prisma.user.findUnique({ where: { googleId: profile.sub } });
    if (byGoogle) return byGoogle;

    const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      if (!profile.emailVerified)
        throw new UnauthorizedException('Your Google email is not verified');
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: profile.sub,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
          status: byEmail.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : undefined,
          avatarUrl: byEmail.avatarUrl ?? profile.picture,
        },
      });
    }

    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        firstName: profile.givenName,
        lastName: profile.familyName,
        googleId: profile.sub,
        avatarUrl: profile.picture,
        status: profile.emailVerified ? 'ACTIVE' : 'PENDING_VERIFICATION',
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
        roles: { create: { role: { connect: { name: Role.CUSTOMER } } } },
        emailPreference: { create: {} },
      },
    });
    await this.email({
      template: EmailTemplateKey.WELCOME,
      to: user.email,
      userId: user.id,
      data: { firstName: user.firstName },
    });
    await this.loyalty.onRegister(user.id, undefined);
    return user;
  }

  // ================================================================ tokens

  /** Issues an access + refresh token pair (also used after a vendor application). */
  async issueTokens(userId: string, sessionId?: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        ownedVendors: { select: { id: true }, take: 1 },
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.role.name as Role),
      vendorId: user.ownedVendors[0]?.id,
    };
    const days = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);
    const sessionExpires = new Date(Date.now() + days * 24 * 60 * MINUTE);
    // One Session per device: created at sign-in, kept (and extended) on every refresh.
    const session = sessionId
      ? await this.prisma.session.update({
          where: { id: sessionId },
          data: { lastUsedAt: new Date(), expiresAt: sessionExpires },
        })
      : await this.prisma.session.create({ data: { userId, expiresAt: sessionExpires } });
    payload.sid = session.id;
    const expiresIn = this.config.get<number>('JWT_ACCESS_TTL_SECONDS', 900);
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: sessionExpires,
      },
    });
    return { accessToken, refreshToken, expiresIn };
  }

  // ================================================================ helpers

  private assertActive(user: User) {
    if (INACTIVE.includes(user.status)) throw new UnauthorizedException('Account is not active');
  }

  /** Invalidates earlier unused codes for the same purpose, then stores the new one (hashed). */
  private async storeCode(user: User, purpose: OtpPurpose, secret: string, ttlMs: number) {
    const now = new Date();
    await this.prisma.otpCode.updateMany({
      where: { email: user.email, purpose, consumedAt: null },
      data: { consumedAt: now },
    });
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        email: user.email,
        purpose,
        codeHash: this.pepper(secret),
        expiresAt: new Date(now.getTime() + ttlMs),
      },
    });
  }

  private findLiveCode(purpose: OtpPurpose, codeHash: string) {
    return this.prisma.otpCode.findFirst({
      where: { purpose, codeHash, consumedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  private async passwordChangedEmail(user: User) {
    await this.email({
      template: EmailTemplateKey.PASSWORD_CHANGED,
      to: user.email,
      userId: user.id,
      data: {
        heading: 'Your password was changed',
        body: `Hi ${user.firstName}, the password for your account was just changed. If this wasn't you, reset it now and contact us.`,
        ctaLabel: 'Reset password',
        ctaUrl: `${this.siteUrl()}/forgot-password`,
      },
    });
  }

  /** Never let an email problem break sign-in flows. */
  private async email(payload: EmailJobPayload) {
    try {
      await this.notifications.sendEmail(payload);
    } catch (error) {
      this.logger.error(`Could not queue ${payload.template} for ${payload.to}: ${String(error)}`);
    }
  }

  private googleConfig() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) return null;
    const api = this.config
      .get<string>('API_PUBLIC_URL', 'http://localhost:4000')
      .replace(/\/$/, '');
    return { clientId, clientSecret, redirectUri: `${api}/api/v1/auth/google/callback` };
  }

  siteUrl(): string {
    return this.config
      .get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
  }

  private pepper(value: string) {
    return hashSecret(value, this.config.getOrThrow<string>('JWT_ACCESS_SECRET'));
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
