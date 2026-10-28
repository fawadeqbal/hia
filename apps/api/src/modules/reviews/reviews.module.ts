import { Module } from '@nestjs/common';
import { AdminReviewsController } from './admin-reviews.controller';
import { QuestionsService } from './questions.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService, QuestionsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
