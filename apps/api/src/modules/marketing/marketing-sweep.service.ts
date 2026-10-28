import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketingAutomationsService } from './automations.service';
import { CampaignsService } from './campaigns.service';

/** Scheduled campaigns every minute, abandoned carts every 15 min, win-back every 6 h. */
@Injectable()
export class MarketingSweepService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MarketingSweepService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly campaigns: CampaignsService,
    private readonly automations: MarketingAutomationsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    const every = (fn: () => Promise<number>, label: string, firstMs: number, ms: number) => {
      const run = async () => {
        try {
          await fn();
        } catch (error) {
          this.logger.error(`${label} failed: ${String(error)}`);
        }
      };
      this.timers.push(
        setTimeout(() => void run(), firstMs),
        setInterval(() => void run(), ms),
      );
    };
    every(() => this.campaigns.dispatchDue(), 'Campaign dispatch', 20_000, 60_000);
    every(() => this.automations.abandonedCarts(), 'Abandoned carts', 45_000, 15 * 60_000);
    every(() => this.automations.winBack(), 'Win-back', 90_000, 6 * 3_600_000);
    this.timers.forEach((t) => t.unref());
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
  }
}
