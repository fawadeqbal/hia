import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  Paginated,
  ProductReviewsDto,
  QuestionDto,
  ReviewDto,
  ReviewEligibilityDto,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { QuestionDtoIn, ReviewDtoIn, ReviewQueryDto } from './dto/review.dto';
import { QuestionsService } from './questions.service';
import { ReviewsService } from './reviews.service';

/** Storefront: public lists + signed-in customers writing reviews / asking questions. */
@ApiTags('Reviews & Q&A')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly questions: QuestionsService,
  ) {}

  @Public()
  @Get('reviews/products/:productId')
  productReviews(
    @Param('productId') productId: string,
    @Query() q: ReviewQueryDto,
  ): Promise<ProductReviewsDto> {
    return this.reviews.forProduct(productId, q);
  }

  @Get('reviews/eligibility/:productId')
  eligibility(
    @CurrentUser('sub') userId: string,
    @Param('productId') productId: string,
  ): Promise<ReviewEligibilityDto> {
    return this.reviews.eligibility(userId, productId);
  }

  @Post('reviews')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  save(@CurrentUser('sub') userId: string, @Body() dto: ReviewDtoIn): Promise<ReviewDto> {
    return this.reviews.save(userId, dto);
  }

  @Delete('reviews/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    return this.reviews.remove(userId, id);
  }

  @Public()
  @Get('questions/products/:productId')
  productQuestions(
    @Param('productId') productId: string,
    @Query() q: ReviewQueryDto,
  ): Promise<Paginated<QuestionDto>> {
    return this.questions.forProduct(productId, q);
  }

  @Post('questions')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  ask(@CurrentUser('sub') userId: string, @Body() dto: QuestionDtoIn): Promise<QuestionDto> {
    return this.questions.ask(userId, dto);
  }
}
