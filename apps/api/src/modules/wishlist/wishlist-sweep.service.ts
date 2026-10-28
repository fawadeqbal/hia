import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WishlistService } from './wishlist.service';

/** Every 15 minutes: price-drop emails for wishlists. Safe to run on several instances (re-bases prices). */
@Injectable()
export class WishlistSweepService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WishlistSweepService.name);
  private timer?: NodeJS.Timeout;
  private first?: NodeJS.Timeout;

  constructor(
    private readonly wishlist: WishlistService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    // First run shortly after start (catches drops made while the API was down), then every 15 minutes.
    this.first = setTimeout(() => void this.run(), 30_000);
    this.first.unref();
    this.timer = setInterval(() => void this.run(), 15 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.first) clearTimeout(this.first);
  }

  async run(): Promise<void> {
    try {
      const sent = await this.wishlist.sweepPriceDrops();
      if (sent > 0) this.logger.log(`Sent ${sent} price-drop email(s)`);
    } catch (error) {
      this.logger.error(`Price-drop sweep failed: ${String(error)}`);
    }
  }
}
