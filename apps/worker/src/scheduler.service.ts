import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@ecommerce/types';
import { MAINTENANCE_JOBS } from './processors/maintenance.processor';

/** Registers repeatable (cron) jobs on startup. Idempotent: same jobId replaces the schedule. */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(@InjectQueue(QUEUE_NAMES.MAINTENANCE) private readonly maintenance: Queue) {}

  async onApplicationBootstrap() {
    const schedules: [string, string][] = [
      [MAINTENANCE_JOBS.RELEASE_EXPIRED_RESERVATIONS, '*/5 * * * *'],
      [MAINTENANCE_JOBS.ABANDONED_CART_SWEEP, '*/30 * * * *'],
      [MAINTENANCE_JOBS.EXPIRE_LOYALTY_POINTS, '0 2 * * *'],
      [MAINTENANCE_JOBS.DAILY_SALES_SUMMARY, '0 7 * * *'],
      [MAINTENANCE_JOBS.BUILD_VENDOR_PAYOUTS, '0 3 1 * *'],
    ];
    for (const [name, pattern] of schedules) {
      await this.maintenance.add(name, {}, { repeat: { pattern }, jobId: name });
    }
    this.logger.log(`Registered ${schedules.length} scheduled jobs`);
  }
}
