import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyService } from './loyalty.service';

/** Expires old unspent points: 1 minute after start, then every 6 hours. */
@Injectable()
export class LoyaltySweepService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LoyaltySweepService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly loyalty: LoyaltyService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.timers = [
      setTimeout(() => void this.run(), 60_000),
      setInterval(() => void this.run(), 6 * 3_600_000),
    ];
    this.timers.forEach((t) => t.unref());
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  async run() {
    try {
      const n = await this.loyalty.expirePoints();
      if (n > 0) this.logger.log(`Expired ${n} points`);
    } catch (error) {
      this.logger.error(`Points expiry failed: ${String(error)}`);
    }
  }
}
