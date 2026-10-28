import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { MarketingAutomationsService } from './automations.service';
import { CampaignsService } from './campaigns.service';
import { AdminMarketingController, NewsletterController } from './marketing.controller';
import { MarketingSweepService } from './marketing-sweep.service';
import { NewsletterService } from './newsletter.service';

/** Newsletter (double opt-in), campaigns, abandoned-cart and win-back emails. */
@Module({
  imports: [NotificationsModule, UsersModule],
  controllers: [NewsletterController, AdminMarketingController],
  providers: [
    NewsletterService,
    CampaignsService,
    MarketingAutomationsService,
    MarketingSweepService,
  ],
  exports: [NewsletterService, CampaignsService, MarketingAutomationsService],
})
export class MarketingModule {}
