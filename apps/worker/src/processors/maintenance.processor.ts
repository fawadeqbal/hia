import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '@ecommerce/types';
import { PrismaService } from '../prisma.service';

export const MAINTENANCE_JOBS = {
  RELEASE_EXPIRED_RESERVATIONS: 'release-expired-reservations',
} as const;

/** Scheduled housekeeping jobs (registered by SchedulerService). */
@Processor(QUEUE_NAMES.MAINTENANCE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case MAINTENANCE_JOBS.RELEASE_EXPIRED_RESERVATIONS: {
        const { count } = await this.prisma.stockReservation.updateMany({
          where: { releasedAt: null, orderId: null, expiresAt: { lt: new Date() } },
          data: { releasedAt: new Date() },
        });
        // TODO: decrement StockLevel.reserved for released reservations
        return { released: count };
      }
      default:
        this.logger.warn(`Unknown maintenance job: ${job.name}`);
        return null;
    }
  }
}
