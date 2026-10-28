import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type CampaignDto, type Paginated, type SubscriberDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CampaignsService } from './campaigns.service';
import {
  AudienceQueryDto,
  CampaignDtoBody,
  EmailDto,
  ScheduleDto,
  SignedEmailDto,
  SubscriberQueryDto,
} from './dto/marketing.dto';
import { NewsletterService } from './newsletter.service';

@ApiTags('Newsletter')
@Public()
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  subscribe(@Body() dto: EmailDto): Promise<{ message: string }> {
    return this.newsletter.subscribe(dto.email);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Body() dto: SignedEmailDto): Promise<{ message: string }> {
    return this.newsletter.confirm(dto.email, dto.sig);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  unsubscribe(@Body() dto: SignedEmailDto): Promise<{ message: string }> {
    return this.newsletter.unsubscribe(dto.email, dto.sig);
  }
}

@ApiTags('Admin · Marketing')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.MARKETING_MANAGER)
@Controller('admin/marketing')
export class AdminMarketingController {
  constructor(
    private readonly newsletter: NewsletterService,
    private readonly campaigns: CampaignsService,
  ) {}

  @Get('subscribers')
  subscribers(@Query() q: SubscriberQueryDto): Promise<Paginated<SubscriberDto>> {
    return this.newsletter.list({
      status: q.status,
      search: q.search,
      page: q.page,
      limit: q.limit,
    });
  }

  @Get('subscribers/export')
  exportSubscribers(): Promise<SubscriberDto[]> {
    return this.newsletter.exportActive();
  }

  @Delete('subscribers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSubscriber(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.newsletter.remove(id, actorId);
  }

  @Get('audience')
  async audience(@Query() q: AudienceQueryDto): Promise<{ count: number }> {
    return { count: await this.campaigns.audienceCount(q.audience, q.segment ?? null) };
  }

  @Get('campaigns')
  list(): Promise<CampaignDto[]> {
    return this.campaigns.list();
  }

  @Get('campaigns/:id')
  get(@Param('id') id: string): Promise<CampaignDto> {
    return this.campaigns.get(id);
  }

  @Post('campaigns')
  create(@Body() dto: CampaignDtoBody, @CurrentUser('sub') actorId: string): Promise<CampaignDto> {
    return this.campaigns.create(dto, actorId);
  }

  @Patch('campaigns/:id')
  update(
    @Param('id') id: string,
    @Body() dto: CampaignDtoBody,
    @CurrentUser('sub') actorId: string,
  ): Promise<CampaignDto> {
    return this.campaigns.update(id, dto, actorId);
  }

  @Delete('campaigns/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.campaigns.remove(id, actorId);
  }

  @Post('campaigns/:id/test')
  @HttpCode(HttpStatus.OK)
  test(@Param('id') id: string, @Body() dto: EmailDto): Promise<{ message: string }> {
    return this.campaigns.sendTest(id, dto.email);
  }

  @Post('campaigns/:id/schedule')
  @HttpCode(HttpStatus.OK)
  schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<CampaignDto> {
    return this.campaigns.schedule(id, dto.scheduledAt ?? null, actorId);
  }

  @Post('campaigns/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<CampaignDto> {
    return this.campaigns.cancel(id, actorId);
  }
}
