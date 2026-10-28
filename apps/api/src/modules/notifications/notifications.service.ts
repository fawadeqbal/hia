import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { MARKETING_EMAILS, QUEUE_NAMES, type EmailJobPayload } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * NotificationsService — the single entry point for sending email.
 * Every module calls sendEmail(); the worker renders and delivers it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue<EmailJobPayload>,
  ) {}

  async sendEmail(payload: EmailJobPayload): Promise<void> {
    const to = payload.to.toLowerCase();

    const suppressed = await this.prisma.emailSuppression.findUnique({ where: { email: to } });
    if (suppressed) {
      await this.log(payload, 'SUPPRESSED', `Suppressed: ${suppressed.reason}`);
      return;
    }

    if (MARKETING_EMAILS.includes(payload.template) && payload.userId) {
      const pref = await this.prisma.emailPreference.findUnique({
        where: { userId: payload.userId },
      });
      if (pref && !pref.marketing) return;
    }

    const log = await this.log(payload, 'QUEUED');
    await this.emailQueue.add(payload.template, { ...payload, to, logId: log.id });
    this.logger.debug(`Queued ${payload.template} → ${to}`);
  }

  listLogs(take = 50) {
    return this.prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take });
  }

  private log(payload: EmailJobPayload, status: 'QUEUED' | 'SUPPRESSED', error?: string) {
    return this.prisma.emailLog.create({
      data: {
        templateKey: payload.template,
        to: payload.to.toLowerCase(),
        status,
        error,
        userId: payload.userId,
      },
    });
  }
}
