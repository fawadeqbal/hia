import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';

/**
 * Every minute: cancel online orders that were not paid in time (releases their stock).
 * Safe with several API instances: each order is claimed with a conditional update.
 */
@Injectable()
export class PaymentExpiryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpiryService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => void this.run(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    try {
      const count = await this.payments.expireUnpaid();
      if (count > 0) this.logger.log(`Cancelled ${count} unpaid order(s)`);
    } catch (error) {
      this.logger.error(`Unpaid order sweep failed: ${String(error)}`);
    }
  }
}
