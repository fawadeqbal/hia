import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Campaign, Prisma } from '@ecommerce/database';
import {
  EmailTemplateKey,
  type CampaignAudience,
  type CampaignContent,
  type CampaignDto,
  type CampaignStats,
  type CampaignStatus,
  type CustomerSegment,
} from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CustomersService } from '../users/customers.service';
import type { CampaignDtoBody } from './dto/marketing.dto';
import { absoluteUrl } from './marketing-rules';
import { NewsletterService } from './newsletter.service';

export interface Recipient {
  email: string;
  userId: string | null;
}

const EDITABLE: CampaignStatus[] = ['DRAFT', 'SCHEDULED', 'CANCELLED'];

/**
 * Email campaigns: draft → scheduled (a time, or now) → sending → sent. Cancel while scheduled.
 * Audience = confirmed newsletter subscribers and / or customers (optionally one segment), deduplicated by address;
 * unsubscribed, opted-out and suppressed addresses are skipped.
 */
@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  private dispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly customers: CustomersService,
    private readonly newsletter: NewsletterService,
  ) {}

  async list(): Promise<CampaignDto[]> {
    const rows = await this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map(toCampaignDto);
  }

  async get(id: string): Promise<CampaignDto> {
    return toCampaignDto(await this.findOrThrow(id));
  }

  async create(dto: CampaignDtoBody, actorId?: string): Promise<CampaignDto> {
    const c = await this.prisma.campaign.create({
      data: { ...this.data(dto), templateKey: EmailTemplateKey.CAMPAIGN },
    });
    await this.audit.log({
      actorId,
      action: 'marketing.campaign.create',
      entityType: 'Campaign',
      entityId: c.id,
      after: { name: c.name },
    });
    return toCampaignDto(c);
  }

  async update(id: string, dto: CampaignDtoBody, actorId?: string): Promise<CampaignDto> {
    const before = await this.findOrThrow(id);
    if (!EDITABLE.includes(before.status as CampaignStatus))
      throw new BadRequestException('A campaign that is sending or sent cannot be edited');
    const c = await this.prisma.campaign.update({ where: { id }, data: this.data(dto) });
    await this.audit.log({
      actorId,
      action: 'marketing.campaign.update',
      entityType: 'Campaign',
      entityId: id,
    });
    return toCampaignDto(c);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const c = await this.findOrThrow(id);
    if (c.status === 'SENDING' || c.status === 'SENT')
      throw new BadRequestException('Sent campaigns are kept for the record');
    await this.prisma.campaign.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'marketing.campaign.delete',
      entityType: 'Campaign',
      entityId: id,
      before: { name: c.name },
    });
  }

  async audienceCount(
    audience: CampaignAudience,
    segment: CustomerSegment | null,
  ): Promise<number> {
    return (await this.recipients(audience, segment)).length;
  }

  async sendTest(id: string, email: string): Promise<{ message: string }> {
    const c = await this.findOrThrow(id);
    await this.notifications.sendEmail({
      template: EmailTemplateKey.CAMPAIGN,
      to: email,
      data: this.emailData(c, email, `[Test] ${c.subject}`),
    });
    return { message: `Test sent to ${email}` };
  }

  /** null = now. The sweep (every minute) sends due campaigns; "now" starts right away. */
  async schedule(id: string, scheduledAt: string | null, actorId?: string): Promise<CampaignDto> {
    const c = await this.findOrThrow(id);
    if (!EDITABLE.includes(c.status as CampaignStatus))
      throw new BadRequestException('This campaign was already sent');
    const at = scheduledAt ? new Date(scheduledAt) : new Date();
    if ((await this.recipients(this.audienceOf(c), this.segmentOf(c))).length === 0)
      throw new BadRequestException('Nobody is in this audience yet');
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: at },
    });
    await this.audit.log({
      actorId,
      action: 'marketing.campaign.schedule',
      entityType: 'Campaign',
      entityId: id,
      after: { scheduledAt: at },
    });
    if (at <= new Date()) void this.dispatchDue();
    return toCampaignDto(updated);
  }

  async cancel(id: string, actorId?: string): Promise<CampaignDto> {
    const { count } = await this.prisma.campaign.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: { status: 'CANCELLED' },
    });
    if (count === 0) throw new BadRequestException('Only a scheduled campaign can be cancelled');
    await this.audit.log({
      actorId,
      action: 'marketing.campaign.cancel',
      entityType: 'Campaign',
      entityId: id,
    });
    return this.get(id);
  }

  /** Sends every scheduled campaign that is due. Each campaign is claimed once (SCHEDULED → SENDING). */
  async dispatchDue(now = new Date()): Promise<number> {
    if (this.dispatching) return 0;
    this.dispatching = true;
    let sent = 0;
    try {
      const due = await this.prisma.campaign.findMany({
        where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      });
      for (const c of due) {
        const { count } = await this.prisma.campaign.updateMany({
          where: { id: c.id, status: 'SCHEDULED' },
          data: { status: 'SENDING' },
        });
        if (count === 0) continue;
        const stats: CampaignStats = { recipients: 0, queued: 0, skipped: 0 };
        try {
          const list = await this.recipients(this.audienceOf(c), this.segmentOf(c));
          stats.recipients = list.length;
          for (const r of list) {
            try {
              await this.notifications.sendEmail({
                template: EmailTemplateKey.CAMPAIGN,
                to: r.email,
                userId: r.userId ?? undefined,
                data: { ...this.emailData(c, r.email, c.subject), campaignId: c.id },
              });
              stats.queued++;
            } catch (error) {
              stats.skipped++;
              this.logger.warn(`Campaign ${c.id} → ${r.email}: ${String(error)}`);
            }
          }
        } finally {
          await this.prisma.campaign.update({
            where: { id: c.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              stats: stats as unknown as Prisma.InputJsonValue,
            },
          });
        }
        sent++;
      }
    } finally {
      this.dispatching = false;
    }
    return sent;
  }

  async recipients(
    audience: CampaignAudience,
    segment: CustomerSegment | null,
  ): Promise<Recipient[]> {
    const map = new Map<string, Recipient>();
    if (audience !== 'customers') {
      const subs = await this.prisma.subscriber.findMany({
        where: { isConfirmed: true, unsubscribedAt: null },
        select: { email: true, userId: true },
      });
      for (const s of subs)
        map.set(s.email.toLowerCase(), { email: s.email.toLowerCase(), userId: s.userId });
    }
    if (audience !== 'subscribers') {
      for (const c of await this.customers.marketingAudience(segment)) {
        map.set(c.email.toLowerCase(), { email: c.email.toLowerCase(), userId: c.userId });
      }
    }
    if (map.size === 0) return [];
    const emails = [...map.keys()];
    const [suppressed, optedOut] = await Promise.all([
      this.prisma.emailSuppression.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      }),
      this.prisma.user.findMany({
        where: { email: { in: emails }, emailPreference: { marketing: false } },
        select: { email: true },
      }),
    ]);
    for (const s of [...suppressed, ...optedOut]) map.delete(s.email.toLowerCase());
    return [...map.values()];
  }

  private emailData(c: Campaign, email: string, subject: string) {
    const content = c.content as unknown as CampaignContent;
    const site = this.config.get<string>('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000';
    return {
      subject,
      heading: content.heading,
      body: content.body,
      ctaLabel: content.ctaLabel ?? undefined,
      ctaUrl: absoluteUrl(site, content.ctaUrl) ?? undefined,
      unsubscribeUrl: this.newsletter.unsubscribeUrl(email),
    };
  }

  private data(dto: CampaignDtoBody) {
    return {
      name: dto.name,
      subject: dto.subject,
      content: {
        heading: dto.content.heading,
        body: dto.content.body.trim(),
        ctaLabel: dto.content.ctaLabel || null,
        ctaUrl: dto.content.ctaUrl || null,
      } as unknown as Prisma.InputJsonValue,
      segment: {
        audience: dto.audience,
        segment: dto.audience === 'subscribers' ? null : (dto.segment ?? null),
      } as unknown as Prisma.InputJsonValue,
    };
  }

  private audienceOf(c: Campaign): CampaignAudience {
    return ((c.segment as { audience?: CampaignAudience } | null)?.audience ??
      'everyone') as CampaignAudience;
  }

  private segmentOf(c: Campaign): CustomerSegment | null {
    return (c.segment as { segment?: CustomerSegment | null } | null)?.segment ?? null;
  }

  private async findOrThrow(id: string): Promise<Campaign> {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }
}

export function toCampaignDto(c: Campaign): CampaignDto {
  const seg = (c.segment ?? {}) as {
    audience?: CampaignAudience;
    segment?: CustomerSegment | null;
  };
  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    content: c.content as unknown as CampaignContent,
    audience: seg.audience ?? 'everyone',
    segment: seg.segment ?? null,
    status: c.status as CampaignStatus,
    scheduledAt: c.scheduledAt?.toISOString() ?? null,
    sentAt: c.sentAt?.toISOString() ?? null,
    stats: (c.stats as unknown as CampaignStats | null) ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
