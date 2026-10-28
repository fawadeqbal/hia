import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, Subscriber } from '@ecommerce/database';
import {
  EmailTemplateKey,
  type Paginated,
  type SubscriberDto,
  type SubscriberStatus,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { signEmail, verifyEmailSignature } from './marketing-rules';

type Query = { status?: SubscriberStatus; search?: string; page: number; limit: number };

const statusWhere = (s?: SubscriberStatus): Prisma.SubscriberWhereInput =>
  s === 'UNSUBSCRIBED'
    ? { unsubscribedAt: { not: null } }
    : s === 'CONFIRMED'
      ? { isConfirmed: true, unsubscribedAt: null }
      : s === 'PENDING'
        ? { isConfirmed: false, unsubscribedAt: null }
        : {};

/**
 * Newsletter with double opt-in. Links in emails carry an HMAC of the address (no login):
 * confirm → subscribed; unsubscribe → unsubscribed + the customer's marketing preference turned off.
 */
@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private get secret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private get site(): string {
    return (this.config.get<string>('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
  }

  link(path: '/unsubscribe' | '/newsletter/confirm', email: string): string {
    const q = new URLSearchParams({
      email: email.toLowerCase(),
      sig: signEmail(email, this.secret),
    });
    return `${this.site}${path}?${q.toString()}`;
  }

  unsubscribeUrl(email: string): string {
    return this.link('/unsubscribe', email);
  }

  /** Same answer whether or not the address is known (no enumeration). */
  async subscribe(email: string, source = 'storefront'): Promise<{ message: string }> {
    const message = 'Check your inbox and confirm your subscription.';
    const existing = await this.prisma.subscriber.findUnique({ where: { email } });
    if (existing?.isConfirmed && !existing.unsubscribedAt) return { message };
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    await this.prisma.subscriber.upsert({
      where: { email },
      update: { isConfirmed: false, unsubscribedAt: null, userId: user?.id ?? null },
      create: { email, source, userId: user?.id ?? null },
    });
    await this.notifications.sendEmail({
      template: EmailTemplateKey.NEWSLETTER_CONFIRM,
      to: email,
      data: {
        heading: 'Confirm your subscription',
        body: 'Tap the button to start receiving our offers and news. If you did not sign up, ignore this email.',
        ctaLabel: 'Confirm subscription',
        ctaUrl: this.link('/newsletter/confirm', email),
      },
    });
    return { message };
  }

  async confirm(email: string, sig: string): Promise<{ message: string }> {
    this.check(email, sig);
    const sub = await this.prisma.subscriber.findUnique({ where: { email } });
    if (!sub)
      throw new BadRequestException(
        'This confirmation link is not valid any more. Subscribe again.',
      );
    await this.prisma.subscriber.update({
      where: { email },
      data: { isConfirmed: true, unsubscribedAt: null },
    });
    return { message: 'You are subscribed. Thanks!' };
  }

  async unsubscribe(email: string, sig: string): Promise<{ message: string }> {
    this.check(email, sig);
    const now = new Date();
    await this.prisma.subscriber.updateMany({ where: { email }, data: { unsubscribedAt: now } });
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await this.prisma.emailPreference.upsert({
        where: { userId: user.id },
        update: { marketing: false },
        create: { userId: user.id, marketing: false },
      });
    }
    return {
      message: 'You will not receive marketing emails any more. Order emails still arrive.',
    };
  }

  // ---------------------------------------------------------------- admin
  async list(q: Query): Promise<Paginated<SubscriberDto>> {
    const where: Prisma.SubscriberWhereInput = {
      ...statusWhere(q.status),
      ...(q.search ? { email: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.subscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.subscriber.count({ where }),
    ]);
    return paginate(rows.map(toSubscriberDto), total, q.page, q.limit);
  }

  /** Confirmed, subscribed addresses (for CSV export). */
  async exportActive(): Promise<SubscriberDto[]> {
    const rows = await this.prisma.subscriber.findMany({
      where: statusWhere('CONFIRMED'),
      orderBy: { createdAt: 'asc' },
      take: 50_000,
    });
    return rows.map(toSubscriberDto);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const sub = await this.prisma.subscriber.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscriber not found');
    await this.prisma.subscriber.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'marketing.subscriber.delete',
      entityType: 'Subscriber',
      entityId: id,
      before: { email: sub.email },
    });
  }

  private check(email: string, sig: string): void {
    if (!verifyEmailSignature(email, sig, this.secret))
      throw new BadRequestException('This link is not valid');
  }
}

export function toSubscriberDto(s: Subscriber): SubscriberDto {
  return {
    id: s.id,
    email: s.email,
    status: s.unsubscribedAt ? 'UNSUBSCRIBED' : s.isConfirmed ? 'CONFIRMED' : 'PENDING',
    source: s.source,
    isCustomer: s.userId !== null,
    createdAt: s.createdAt.toISOString(),
  };
}
