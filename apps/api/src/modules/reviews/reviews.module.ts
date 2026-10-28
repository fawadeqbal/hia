import { Module } from '@nestjs/common';
import { AdminReviewsController } from './admin-reviews.controller';
import { QuestionsService } from './questions.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { VendorReviewsController } from './vendor-reviews.controller';

import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [LoyaltyModule],
  controllers: [ReviewsController, VendorReviewsController, AdminReviewsController],
  providers: [ReviewsService, QuestionsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
