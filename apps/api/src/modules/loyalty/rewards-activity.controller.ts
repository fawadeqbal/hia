import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  type OrderRewardsDto,
  type Paginated,
  type RewardActivityItem,
  type RewardActivitySummary,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RewardActivityQueryDto, RewardSummaryQueryDto } from './dto/rewards.dto';
import { RewardsActivityService } from './rewards-activity.service';

/** Where points, coupons and gift cards were used — one ledger, plus views per order / coupon / customer. */
@ApiTags('Admin · Rewards activity')
@ApiBearerAuth()
@Controller('admin')
export class RewardsActivityController {
  constructor(private readonly rewards: RewardsActivityService) {}

  @Get('loyalty/activity')
  @Roles(Role.ADMIN, Role.MARKETING_MANAGER, Role.SUPPORT_AGENT)
  activity(@Query() q: RewardActivityQueryDto): Promise<Paginated<RewardActivityItem>> {
    return this.rewards.activity(q);
  }

  @Get('loyalty/activity/summary')
  @Roles(Role.ADMIN, Role.MARKETING_MANAGER, Role.SUPPORT_AGENT)
  summary(@Query() q: RewardSummaryQueryDto): Promise<RewardActivitySummary> {
    return this.rewards.summary(q);
  }

  @Get('orders/:id/rewards')
  @Roles(Role.ADMIN, Role.SUPPORT_AGENT, Role.MARKETING_MANAGER)
  order(@Param('id') id: string): Promise<OrderRewardsDto> {
    return this.rewards.forOrder(id);
  }

  @Get('promotions/coupons/:id/usage')
  @Roles(Role.ADMIN, Role.MARKETING_MANAGER)
  couponUsage(
    @Param('id') id: string,
    @Query() q: PaginationQueryDto,
  ): Promise<Paginated<RewardActivityItem>> {
    return this.rewards.activity({ couponId: id, page: q.page, limit: q.limit });
  }

  @Get('customers/:id/rewards')
  @Roles(Role.ADMIN, Role.SUPPORT_AGENT, Role.MARKETING_MANAGER)
  customer(
    @Param('id') id: string,
    @Query() q: PaginationQueryDto,
  ): Promise<Paginated<RewardActivityItem>> {
    return this.rewards.activity({ userId: id, page: q.page, limit: q.limit });
  }
}
