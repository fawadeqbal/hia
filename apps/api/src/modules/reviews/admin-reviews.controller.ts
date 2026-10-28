import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type Paginated, type QuestionDto, type ReviewDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnswerDtoIn, ModerateDto, ReviewQueryDto } from './dto/review.dto';
import { QuestionsService } from './questions.service';
import { ReviewsService } from './reviews.service';

@ApiTags('Admin · Reviews & Q&A')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT_AGENT)
@Controller('admin')
export class AdminReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly questions: QuestionsService,
  ) {}

  @Get('reviews')
  listReviews(@Query() q: ReviewQueryDto): Promise<Paginated<ReviewDto>> {
    return this.reviews.adminList(q);
  }

  @Post('reviews/:id/moderate')
  @HttpCode(HttpStatus.OK)
  moderateReview(
    @CurrentUser('sub') actorId: string,
    @Param('id') id: string,
    @Body() dto: ModerateDto,
  ): Promise<ReviewDto> {
    return this.reviews.moderate(actorId, id, dto);
  }

  @Get('questions')
  listQuestions(@Query() q: ReviewQueryDto): Promise<Paginated<QuestionDto>> {
    return this.questions.adminList(q);
  }

  @Post('questions/:id/moderate')
  @HttpCode(HttpStatus.OK)
  moderateQuestion(
    @CurrentUser('sub') actorId: string,
    @Param('id') id: string,
    @Body() dto: ModerateDto,
  ): Promise<QuestionDto> {
    return this.questions.moderate(actorId, id, dto);
  }

  @Post('questions/:id/answers')
  @HttpCode(HttpStatus.OK)
  answer(
    @CurrentUser('sub') actorId: string,
    @Param('id') id: string,
    @Body() dto: AnswerDtoIn,
  ): Promise<QuestionDto> {
    return this.questions.adminAnswer(actorId, id, dto.body);
  }
}
