import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type Paginated, type QuestionDto, type ReviewDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnswerDtoIn, ReviewQueryDto, VendorReplyDto } from './dto/review.dto';
import { QuestionsService } from './questions.service';
import { ReviewsService } from './reviews.service';

@ApiTags('Seller · Reviews & Q&A')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor')
export class VendorReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly questions: QuestionsService,
  ) {}

  @Get('reviews')
  listReviews(
    @CurrentUser('sub') userId: string,
    @Query() q: ReviewQueryDto,
  ): Promise<Paginated<ReviewDto>> {
    return this.reviews.vendorList(userId, q);
  }

  @Post('reviews/:id/reply')
  @HttpCode(HttpStatus.OK)
  reply(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: VendorReplyDto,
  ): Promise<ReviewDto> {
    return this.reviews.reply(userId, id, dto.reply);
  }

  @Get('questions')
  listQuestions(
    @CurrentUser('sub') userId: string,
    @Query() q: ReviewQueryDto,
  ): Promise<Paginated<QuestionDto>> {
    return this.questions.vendorList(userId, q);
  }

  @Post('questions/:id/answers')
  @HttpCode(HttpStatus.OK)
  answer(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AnswerDtoIn,
  ): Promise<QuestionDto> {
    return this.questions.vendorAnswer(userId, id, dto.body);
  }
}
