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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type CouponDto, type PromotionDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { vendorIdOf } from '../reviews/reviews.service';
import { CouponDtoIn, PromotionDtoIn } from './dto/promotion.dto';
import { PromotionsService } from './promotions.service';

@ApiTags('Admin · Promotions')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.MARKETING_MANAGER)
@Controller('admin/promotions')
export class AdminPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get('coupons') listCoupons(): Promise<CouponDto[]> {
    return this.promotions.listCoupons(null);
  }
  @Get('coupons/:id') getCoupon(@Param('id') id: string): Promise<CouponDto> {
    return this.promotions.getCoupon(null, id);
  }
  @Post('coupons') createCoupon(
    @Body() dto: CouponDtoIn,
    @CurrentUser('sub') actorId: string,
  ): Promise<CouponDto> {
    return this.promotions.createCoupon(null, dto, actorId);
  }
  @Patch('coupons/:id') updateCoupon(
    @Param('id') id: string,
    @Body() dto: CouponDtoIn,
    @CurrentUser('sub') actorId: string,
  ): Promise<CouponDto> {
    return this.promotions.updateCoupon(null, id, dto, actorId);
  }
  @Delete('coupons/:id') @HttpCode(HttpStatus.NO_CONTENT) removeCoupon(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<void> {
    return this.promotions.removeCoupon(null, id, actorId);
  }

  @Get('discounts') listDiscounts(): Promise<PromotionDto[]> {
    return this.promotions.listPromotions();
  }
  @Get('discounts/:id') getDiscount(@Param('id') id: string): Promise<PromotionDto> {
    return this.promotions.getPromotion(id);
  }
  @Post('discounts') createDiscount(
    @Body() dto: PromotionDtoIn,
    @CurrentUser('sub') actorId: string,
  ): Promise<PromotionDto> {
    return this.promotions.createPromotion(dto, actorId);
  }
  @Patch('discounts/:id') updateDiscount(
    @Param('id') id: string,
    @Body() dto: PromotionDtoIn,
    @CurrentUser('sub') actorId: string,
  ): Promise<PromotionDto> {
    return this.promotions.updatePromotion(id, dto, actorId);
  }
  @Delete('discounts/:id') @HttpCode(HttpStatus.NO_CONTENT) removeDiscount(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<void> {
    return this.promotions.removePromotion(id, actorId);
  }
}

/** Seller coupons: only for the seller's products, paid by the seller. */
@ApiTags('Seller · Coupons')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/coupons')
export class VendorCouponsController {
  constructor(
    private readonly promotions: PromotionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get() async list(@CurrentUser('sub') userId: string): Promise<CouponDto[]> {
    return this.promotions.listCoupons(await vendorIdOf(this.prisma, userId));
  }
  @Get(':id') async get(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<CouponDto> {
    return this.promotions.getCoupon(await vendorIdOf(this.prisma, userId), id);
  }
  @Post() async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CouponDtoIn,
  ): Promise<CouponDto> {
    return this.promotions.createCoupon(await vendorIdOf(this.prisma, userId), dto, userId);
  }
  @Patch(':id') async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CouponDtoIn,
  ): Promise<CouponDto> {
    return this.promotions.updateCoupon(await vendorIdOf(this.prisma, userId), id, dto, userId);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) async remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.promotions.removeCoupon(await vendorIdOf(this.prisma, userId), id, userId);
  }
}
