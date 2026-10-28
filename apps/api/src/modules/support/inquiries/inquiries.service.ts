import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@ecommerce/database';
import {
  EmailTemplateKey,
  INQUIRY_STATUS_LABELS,
  INQUIRY_TOPIC_LABELS,
  Role,
  type InquiryCreatedDto,
  type InquiryDto,
  type InquiryInput,
  type InquiryListItem,
  type InquiryStatus,
  type InquiryTopic,
  type Paginated,
} from '@ecommerce/types';
import { paginate } from '../../../common/dto/pagination.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';

export const inquiryInclude = {
  messages: {
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { firstName: true, lastName: true } } },
  },
} satisfies Prisma.TicketInclude;
type InquiryRow = Prisma.TicketGetPayload<{ include: typeof inquiryInclude }>;

const listInclude = {
  messages: { where: { isInternal: false }, orderBy: { createdAt: 'asc' }, take: 1 },
} satisfies Prisma.TicketInclude;
type InquiryListRow = Prisma.TicketGetPayload<{ include: typeof listInclude }>;

const firstLine = (s: string, max = 120) => {
  const line = s.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

export function toInquiryListItem(t: InquiryListRow | InquiryRow): InquiryListItem {
  const message = t.messages.find((m) => !m.isInternal);
  return {
    id: t.id,
    number: t.number,
    topic: t.topic as InquiryTopic,
    status: t.status as InquiryStatus,
    name: t.name ?? t.email,
    phone: t.phone,
    email: t.email || null,
    subject: t.subject,
    preview: message ? firstLine(message.body) : '',
    createdAt: t.createdAt.toISOString(),
  };
}

export function toInquiryDto(t: InquiryRow): InquiryDto {
  const message = t.messages.find((m) => !m.isInternal);
  return {
    ...toInquiryListItem(t),
    message: message?.body ?? '',
    notes: t.messages
      .filter((m) => m.isInternal)
      .map((m) => ({
        id: m.id,
        body: m.body,
        authorName: m.author ? `${m.author.firstName} ${m.author.lastName}`.trim() : null,
        createdAt: m.createdAt.toISOString(),
      })),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Inquiry numbers: INQ-YYMMDD-XXXX. */
function inquiryNumber(now = new Date()): string {
  const d = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  return `INQ-${d}-${rand}`;
}

/**
 * Website inquiries (Contact page): chair repair requests, wholesale / bulk / institutional quotes and
 * general questions. Stored as tickets; staff notes are internal ticket messages.
 */
@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async create(input: InquiryInput, userId: string | null): Promise<InquiryCreatedDto> {
    const email = (input.email ?? '').trim().toLowerCase();
    const company = input.company?.trim() || null;
    const subject = `${INQUIRY_TOPIC_LABELS[input.topic]} — ${company ?? input.name}`;
    const body = [company ? `Company / institution: ${company}` : null, input.message.trim()]
      .filter(Boolean)
      .join('\n\n');

    let created: { id: string; number: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const number = inquiryNumber();
      if (await this.prisma.ticket.findUnique({ where: { number }, select: { id: true } })) continue;
      created = await this.prisma.ticket.create({
        data: {
          number,
          topic: input.topic,
          name: input.name.trim(),
          phone: input.phone.trim(),
          email,
          subject,
          customerId: userId,
          priority: input.topic === 'QUOTE' ? 'HIGH' : 'MEDIUM',
          messages: { create: { body, authorId: userId, isInternal: false } },
        },
        select: { id: true, number: true },
      });
    }
    if (!created) throw new Error('Could not create an inquiry number');

    await this.emailShop(created.id, created.number, input, subject);
    if (email) {
      await this.email({
        template: EmailTemplateKey.TICKET_CREATED,
        to: email,
        data: {
          ticketNumber: created.number,
          heading: 'We received your message',
          body: `Thank you, ${input.name.trim()}. Your request ${created.number} (${INQUIRY_TOPIC_LABELS[input.topic].toLowerCase()}) has reached our team. We will call or email you soon.`,
        },
      });
    }
    return { number: created.number };
  }

  async adminList(query: {
    page: number;
    limit: number;
    status?: InquiryStatus;
    topic?: InquiryTopic;
    search?: string;
  }): Promise<Paginated<InquiryListItem>> {
    const search = query.search?.trim();
    const where: Prisma.TicketWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.topic ? { topic: query.topic } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { subject: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return paginate(rows.map(toInquiryListItem), total, query.page, query.limit);
  }

  async adminGet(id: string): Promise<InquiryDto> {
    return toInquiryDto(await this.find(id));
  }

  async setStatus(id: string, status: InquiryStatus, actorId: string): Promise<InquiryDto> {
    const before = await this.find(id);
    if (before.status === status) return toInquiryDto(before);
    await this.prisma.ticket.update({ where: { id }, data: { status } });
    await this.audit.log({
      actorId,
      action: 'support.inquiry.status',
      entityType: 'Ticket',
      entityId: id,
      before: { status: before.status },
      after: { status },
    });
    return this.adminGet(id);
  }

  async addNote(id: string, body: string, actorId: string): Promise<InquiryDto> {
    const ticket = await this.find(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: { ticketId: id, body: body.trim(), authorId: actorId, isInternal: true },
      });
      // A note on a new inquiry means someone is handling it.
      await tx.ticket.update({
        where: { id },
        data: ticket.status === 'OPEN' ? { status: 'PENDING' } : { updatedAt: new Date() },
      });
    });
    await this.audit.log({
      actorId,
      action: 'support.inquiry.note',
      entityType: 'Ticket',
      entityId: id,
    });
    return this.adminGet(id);
  }

  // ---------------------------------------------------------------- helpers

  private async find(id: string): Promise<InquiryRow> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: inquiryInclude });
    if (!ticket) throw new NotFoundException('Inquiry not found');
    return ticket;
  }

  /** The shop owner (super admin / admins) gets every new inquiry by email. */
  private async emailShop(id: string, number: string, input: InquiryInput, subject: string) {
    const admins = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: { name: { in: [Role.ADMIN, Role.SUPER_ADMIN] } } } },
        status: { not: 'DELETED' },
      },
      select: { id: true, email: true },
    });
    const adminUrl = this.config.get<string>('NEXT_PUBLIC_ADMIN_URL', 'http://localhost:3001');
    const contact = [input.phone, input.email].filter(Boolean).join(' · ');
    for (const admin of admins) {
      await this.email({
        template: EmailTemplateKey.ADMIN_NEW_TICKET,
        to: admin.email,
        userId: admin.id,
        data: {
          ticketNumber: number,
          heading: `New inquiry: ${INQUIRY_TOPIC_LABELS[input.topic]}`,
          body: `${subject}\n${input.name} — ${contact}\n\n${input.message.trim()}\n\nStatus: ${INQUIRY_STATUS_LABELS.OPEN}`,
          ctaLabel: 'Open inquiry',
          ctaUrl: `${adminUrl}/inquiries/${id}`,
        },
      });
    }
  }

  /** An email failure must never fail the inquiry. */
  private async email(payload: Parameters<NotificationsService['sendEmail']>[0]) {
    try {
      await this.notifications.sendEmail(payload);
    } catch {
      // logged by the notifications module / worker
    }
  }
}
