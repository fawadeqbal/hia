import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { renderEmail } from '@ecommerce/email-templates';
import { QUEUE_NAMES, type EmailJobPayload } from '@ecommerce/types';
import { PrismaService } from '../prisma.service';
import { MAIL_PROVIDER, type MailProvider } from '../mail/mail-provider.interface';

/** Renders and delivers every email. Retries with exponential backoff (set by the producer). */
@Processor(QUEUE_NAMES.EMAIL, { concurrency: 10 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
  ) {
    super();
  }

  async process(job: Job<EmailJobPayload>): Promise<void> {
    const { template, to, data, logId, locale = 'en' } = job.data;

    const override = await this.prisma.emailTemplate.findUnique({
      where: { key_locale: { key: template, locale } },
    });
    if (override && !override.isActive) {
      this.logger.warn(`Template ${template} is disabled; skipping`);
      return;
    }

    const rendered = await renderEmail(
      template,
      data ?? {},
      override
        ? {
            subject: override.subject,
            ...((override.overrides ?? {}) as Record<string, string | null>),
          }
        : undefined,
    );

    try {
      const result = await this.mail.send({ to, ...rendered });
      if (logId) {
        await this.prisma.emailLog.update({
          where: { id: logId },
          data: {
            status: 'SENT',
            subject: rendered.subject,
            provider: result.provider,
            providerMessageId: result.messageId,
            sentAt: new Date(),
            error: null,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed ${template} → ${to}: ${message}`);
      if (logId) {
        await this.prisma.emailLog.update({
          where: { id: logId },
          data: { status: 'FAILED', subject: rendered.subject, error: message },
        });
      }
      throw error; // let BullMQ retry
    }
  }
}
