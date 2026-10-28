import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@ecommerce/database';
import { EmailTemplateKey } from '@ecommerce/types';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dueCartEmail, parseDelays } from './marketing-rules';
import { NewsletterService } from './newsletter.service';

const BATCH = 300;

/** Automatic marketing emails: abandoned-cart sequence and win-back. Opt-outs are honoured by NotificationsService. */
@Injectable()
export class MarketingAutomationsService {
  private readonly logger = new Logger(MarketingAutomationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly newsletter: NewsletterService,
  ) {}

  private get site(): string {
    return (this.config.get<string>('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
  }

  /** Signed-in customers' carts with items, idle past the next delay of the sequence. */
  async abandonedCarts(now = new Date()): Promise<number> {
    const [enabled, delaysSetting, coupon] = await Promise.all([
      readSetting(this.prisma, 'marketing.abandonedCartEnabled', true),
      readSetting(this.prisma, 'marketing.abandonedCartDelays', '1,24,72'),
      readSetting(this.prisma, 'marketing.abandonedCartCoupon', ''),
    ]);
    const delays = parseDelays(String(delaysSetting));
    if (!enabled || delays.length === 0) return 0;
    const carts = await this.prisma.cart.findMany({
      where: {
        userId: { not: null },
        items: { some: {} },
        updatedAt: { lte: new Date(now.getTime() - delays[0]! * 3_600_000) },
        user: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true,
        updatedAt: true,
        userId: true,
        user: { select: { email: true, firstName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: BATCH,
    });
    if (carts.length === 0) return 0;
    const recoveries = new Map(
      (
        await this.prisma.cartRecovery.findMany({
          where: { cartId: { in: carts.map((c) => c.id) } },
        })
      ).map((r) => [r.cartId, r]),
    );
    let sent = 0;
    for (const cart of carts) {
      const step = dueCartEmail(cart.updatedAt, recoveries.get(cart.id) ?? null, delays, now);
      if (step === null || !cart.user) continue;
      const last = step === delays.length - 1;
      await this.notifications.sendEmail({
        template: EmailTemplateKey.ABANDONED_CART,
        to: cart.user.email,
        userId: cart.userId!,
        data: {
          firstName: cart.user.firstName,
          itemCount: cart._count.items,
          cartUrl: `${this.site}/cart`,
          couponCode: last && coupon ? String(coupon) : undefined,
          unsubscribeUrl: this.newsletter.unsubscribeUrl(cart.user.email),
        },
      });
      await this.prisma.cartRecovery.upsert({
        where: { cartId: cart.id },
        update: { step: step + 1, cartUpdatedAt: cart.updatedAt, lastSentAt: now },
        create: { cartId: cart.id, step: step + 1, cartUpdatedAt: cart.updatedAt, lastSentAt: now },
      });
      sent++;
    }
    return sent;
  }

  /** Customers whose last order is older than marketing.winBackDays and who got no win-back since that order. */
  async winBack(now = new Date()): Promise<number> {
    const [enabled, days, coupon] = await Promise.all([
      readSetting(this.prisma, 'marketing.winBackEnabled', true),
      readSetting(this.prisma, 'marketing.winBackDays', 90),
      readSetting(this.prisma, 'marketing.winBackCoupon', ''),
    ]);
    if (!enabled) return 0;
    const cutoff = new Date(now.getTime() - Math.max(14, Number(days) || 90) * 86_400_000);
    const rows = await this.prisma.$queryRaw<
      { id: string; email: string; firstName: string }[]
    >(Prisma.sql`
      SELECT u."id", u."email", u."firstName"
      FROM "User" u
      JOIN (
        SELECT o."userId", MAX(o."placedAt") AS "lastOrderAt"
        FROM "Order" o
        WHERE o."userId" IS NOT NULL AND o."status" NOT IN ('CANCELLED', 'PENDING_PAYMENT')
        GROUP BY o."userId"
      ) s ON s."userId" = u."id"
      WHERE u."deletedAt" IS NULL AND u."status"::text = 'ACTIVE'
        AND s."lastOrderAt" < ${cutoff}
        AND NOT EXISTS (
          SELECT 1 FROM "EmailLog" l
          WHERE l."userId" = u."id" AND l."templateKey" = ${EmailTemplateKey.WIN_BACK} AND l."createdAt" > s."lastOrderAt"
        )
      ORDER BY s."lastOrderAt" ASC
      LIMIT ${BATCH}`);
    for (const u of rows) {
      await this.notifications.sendEmail({
        template: EmailTemplateKey.WIN_BACK,
        to: u.email,
        userId: u.id,
        data: {
          subject: `We miss you, ${u.firstName}`,
          heading: `It's been a while, ${u.firstName}`,
          body: [
            'New products arrive every week from sellers across the country.',
            coupon
              ? `Come back and use code ${String(coupon)} on your next order.`
              : 'Come and see what is new.',
          ].join('\n'),
          ctaLabel: "See what's new",
          ctaUrl: `${this.site}/products?sort=newest`,
          unsubscribeUrl: this.newsletter.unsubscribeUrl(u.email),
        },
      });
    }
    if (rows.length) this.logger.log(`Win-back emails: ${rows.length}`);
    return rows.length;
  }
}
