import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  Role,
  type GiftCardBalanceDto,
  type GiftCardDto,
  type LoyaltyMemberDto,
  type LoyaltySummaryDto,
  type TierDto,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AdjustGiftCardDto,
  AdjustPointsDto,
  GiftCardActiveDto,
  IssueGiftCardDto,
  UpdateTierDto,
} from './dto/loyalty.dto';
import { GiftCardsService } from './gift-cards.service';
import { LoyaltyService } from './loyalty.service';

@ApiTags('Loyalty & gift cards')
@ApiBearerAuth()
@Controller()
export class LoyaltyController {
  constructor(
    private readonly loyalty: LoyaltyService,
    private readonly giftCards: GiftCardsService,
  ) {}

  @Get('loyalty')
  summary(@CurrentUser('sub') userId: string): Promise<LoyaltySummaryDto> {
    return this.loyalty.summary(userId);
  }

  @Public()
  @Get('gift-cards/:code/balance')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  balance(@Param('code') code: string): Promise<GiftCardBalanceDto> {
    return this.giftCards.balance(code);
  }
}

@ApiTags('Admin · Loyalty & gift cards')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.MARKETING_MANAGER)
@Controller('admin')
export class AdminLoyaltyController {
  constructor(
    private readonly loyalty: LoyaltyService,
    private readonly giftCards: GiftCardsService,
  ) {}

  @Get('loyalty/tiers') tiers(): Promise<TierDto[]> {
    return this.loyalty.tiers();
  }
  @Patch('loyalty/tiers/:id') updateTier(
    @Param('id') id: string,
    @Body() dto: UpdateTierDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<TierDto> {
    return this.loyalty.updateTier(id, dto, actorId);
  }
  @Get('loyalty/members') member(@Query('email') email: string): Promise<LoyaltyMemberDto> {
    return this.loyalty.member(email ?? '');
  }
  @Post('loyalty/members/:userId/adjust')
  @HttpCode(HttpStatus.OK)
  adjust(
    @Param('userId') userId: string,
    @Body() dto: AdjustPointsDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<LoyaltyMemberDto> {
    return this.loyalty.adjust(userId, dto, actorId);
  }

  @Get('gift-cards') list(): Promise<GiftCardDto[]> {
    return this.giftCards.list();
  }
  @Get('gift-cards/:id') get(@Param('id') id: string): Promise<GiftCardDto> {
    return this.giftCards.get(id);
  }
  @Post('gift-cards') issue(
    @Body() dto: IssueGiftCardDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<GiftCardDto> {
    return this.giftCards.issue(dto, actorId);
  }
  @Post('gift-cards/:id/adjust')
  @HttpCode(HttpStatus.OK)
  adjustCard(
    @Param('id') id: string,
    @Body() dto: AdjustGiftCardDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<GiftCardDto> {
    return this.giftCards.adjust(id, dto, actorId);
  }
  @Patch('gift-cards/:id') setActive(
    @Param('id') id: string,
    @Body() dto: GiftCardActiveDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<GiftCardDto> {
    return this.giftCards.setActive(id, dto.isActive, actorId);
  }
}
