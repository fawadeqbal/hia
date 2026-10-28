import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { EmailTemplate, Prisma } from '@ecommerce/database';
import { SAMPLE_EMAIL_DATA, renderEmail, templateRegistry } from '@ecommerce/email-templates';
import {
  EmailTemplateKey,
  REQUIRED_EMAILS,
  SENDER_CONTENT_EMAILS,
  emailGroupOf,
  emailTemplateName,
  isMarketingEmail,
  type EmailLogItem,
  type EmailLogStatus,
  type EmailPreviewDto,
  type EmailSuppressionDto,
  type EmailTemplateDetail,
  type EmailTemplateInput,
  type EmailTemplateListItem,
  type EmailTemplateOverrides,
  type Paginated,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { validateTemplateEdit } from './email-template-rules';
import { NotificationsService } from './notifications.service';

const LOCALE = 'en';
const KEYS = Object.values(EmailTemplateKey) as EmailTemplateKey[];
type LogQuery = {
  status?: EmailLogStatus;
  template?: string;
  search?: string;
  page: number;
  limit: number;
};

/** Admin → Settings → Email templates: per-template subject / content overrides, on-off, preview, test, log. */
@Injectable()
export class EmailAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(): Promise<EmailTemplateListItem[]> {
    const rows = new Map(
      (await this.prisma.emailTemplate.findMany({ where: { locale: LOCALE } })).map((r) => [
        r.key,
        r,
      ]),
    );
    return KEYS.map((k) => this.item(k, rows.get(k) ?? null)).sort(
      (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
    );
  }

  async get(key: string): Promise<EmailTemplateDetail> {
    const k = this.keyOrThrow(key);
    const row = await this.prisma.emailTemplate.findUnique({
      where: { key_locale: { key: k, locale: LOCALE } },
    });
    return this.detail(k, row);
  }

  async save(
    key: string,
    input: EmailTemplateInput,
    actorId?: string,
  ): Promise<EmailTemplateDetail> {
    const k = this.keyOrThrow(key);
    const v = this.validate(k, input);
    const before = await this.prisma.emailTemplate.findUnique({
      where: { key_locale: { key: k, locale: LOCALE } },
    });
    const data = {
      name: emailTemplateName(k),
      subject: v.subject ?? '',
      overrides: (v.overrides ?? undefined) as Prisma.InputJsonValue | undefined,
      isActive: input.isActive,
    };
    const row = await this.prisma.emailTemplate.upsert({
      where: { key_locale: { key: k, locale: LOCALE } },
      update: { ...data, overrides: (v.overrides ?? null) as unknown as Prisma.InputJsonValue },
      create: { key: k, locale: LOCALE, ...data },
    });
    await this.audit.log({
      actorId,
      action: 'email.template.update',
      entityType: 'EmailTemplate',
      entityId: k,
      before: before
        ? { subject: before.subject, overrides: before.overrides, isActive: before.isActive }
        : null,
      after: { subject: row.subject, overrides: row.overrides, isActive: row.isActive },
    });
    return this.detail(k, row);
  }

  async reset(key: string, actorId?: string): Promise<EmailTemplateDetail> {
    const k = this.keyOrThrow(key);
    await this.prisma.emailTemplate.deleteMany({ where: { key: k, locale: LOCALE } });
    await this.audit.log({
      actorId,
      action: 'email.template.reset',
      entityType: 'EmailTemplate',
      entityId: k,
    });
    return this.detail(k, null);
  }

  /** Renders unsaved edits with sample data. */
  async preview(key: string, input: EmailTemplateInput): Promise<EmailPreviewDto> {
    const k = this.keyOrThrow(key);
    const v = this.validate(k, input);
    const r = await renderEmail(k, this.sample(k), { subject: v.subject, ...(v.overrides ?? {}) });
    return { subject: r.subject, html: r.html };
  }

  /** Sends the saved version with sample data. */
  async sendTest(key: string, email: string): Promise<{ message: string }> {
    const k = this.keyOrThrow(key);
    const row = await this.prisma.emailTemplate.findUnique({
      where: { key_locale: { key: k, locale: LOCALE } },
    });
    if (row && !row.isActive)
      throw new BadRequestException('This email is turned off. Turn it on to send a test.');
    await this.notifications.sendEmail({ template: k, to: email, data: this.sample(k) });
    return { message: `Test sent to ${email} with sample data` };
  }

  // ---------------------------------------------------------------- log + suppressions
  async logs(q: LogQuery): Promise<Paginated<EmailLogItem>> {
    const where: Prisma.EmailLogWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.template ? { templateKey: q.template } : {}),
      ...(q.search ? { to: { contains: q.search.toLowerCase() } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.emailLog.count({ where }),
    ]);
    return paginate(
      rows.map((l) => ({
        id: l.id,
        templateKey: l.templateKey,
        to: l.to,
        subject: l.subject,
        status: l.status as EmailLogStatus,
        error: l.error,
        provider: l.provider,
        createdAt: l.createdAt.toISOString(),
        sentAt: l.sentAt?.toISOString() ?? null,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async suppressions(): Promise<EmailSuppressionDto[]> {
    const rows = await this.prisma.emailSuppression.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map((s) => ({
      id: s.id,
      email: s.email,
      reason: s.reason,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async addSuppression(email: string, actorId?: string): Promise<EmailSuppressionDto> {
    const s = await this.prisma.emailSuppression.upsert({
      where: { email },
      update: {},
      create: { email, reason: 'MANUAL' },
    });
    await this.audit.log({
      actorId,
      action: 'email.suppression.add',
      entityType: 'EmailSuppression',
      entityId: s.id,
      after: { email },
    });
    return { id: s.id, email: s.email, reason: s.reason, createdAt: s.createdAt.toISOString() };
  }

  async removeSuppression(id: string, actorId?: string): Promise<void> {
    const s = await this.prisma.emailSuppression.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Not on the list');
    await this.prisma.emailSuppression.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'email.suppression.remove',
      entityType: 'EmailSuppression',
      entityId: id,
      before: { email: s.email },
    });
  }

  // ---------------------------------------------------------------- helpers
  private validate(k: EmailTemplateKey, input: EmailTemplateInput) {
    const v = validateTemplateEdit(k, input, {
      blocks: Boolean(templateRegistry[k].blocks),
      extraVariables: Object.keys(SAMPLE_EMAIL_DATA),
    });
    if (v.problems.length) throw new BadRequestException(v.problems.join('. '));
    return v;
  }

  private sample(k: EmailTemplateKey): Record<string, unknown> {
    return SENDER_CONTENT_EMAILS.includes(k)
      ? {
          ...SAMPLE_EMAIL_DATA,
          subject: 'Sample campaign',
          heading: 'Big sale this week',
          body: 'Everything is 10% off.\nUntil Sunday only.',
          ctaLabel: 'Shop now',
        }
      : SAMPLE_EMAIL_DATA;
  }

  private keyOrThrow(key: string): EmailTemplateKey {
    if (!(KEYS as string[]).includes(key)) throw new NotFoundException('Unknown email template');
    return key as EmailTemplateKey;
  }

  private item(k: EmailTemplateKey, row: EmailTemplate | null): EmailTemplateListItem {
    const overrides = (row?.overrides ?? null) as EmailTemplateOverrides | null;
    return {
      key: k,
      name: emailTemplateName(k),
      group: emailGroupOf(k),
      marketing: isMarketingEmail(k),
      required: REQUIRED_EMAILS.includes(k),
      blocks: Boolean(templateRegistry[k].blocks) && !SENDER_CONTENT_EMAILS.includes(k),
      editable: !SENDER_CONTENT_EMAILS.includes(k),
      isActive: row?.isActive ?? true,
      customized: Boolean(
        row &&
        (row.subject || (overrides && Object.values(overrides).some(Boolean)) || !row.isActive),
      ),
      subject: row?.subject || null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  private detail(k: EmailTemplateKey, row: EmailTemplate | null): EmailTemplateDetail {
    return {
      ...this.item(k, row),
      defaultSubject: templateRegistry[k].subject(this.sample(k)),
      overrides: ((row?.overrides ?? {}) as EmailTemplateOverrides) ?? {},
    };
  }
}
