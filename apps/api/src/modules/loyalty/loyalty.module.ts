import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { GiftCardsService } from './gift-cards.service';
import { AdminLoyaltyController, LoyaltyController } from './loyalty.controller';
import { LoyaltySweepService } from './loyalty-sweep.service';
import { LoyaltyService } from './loyalty.service';
import { RewardsActivityController } from './rewards-activity.controller';
import { RewardsActivityService } from './rewards-activity.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LoyaltyController, AdminLoyaltyController, RewardsActivityController],
  providers: [LoyaltyService, GiftCardsService, LoyaltySweepService, RewardsActivityService],
  exports: [LoyaltyService, GiftCardsService],
})
export class LoyaltyModule {}
