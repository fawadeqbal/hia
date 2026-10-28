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
import { Role, type CouponDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CouponDtoIn } from './dto/promotion.dto';
import { PromotionsService } from './promotions.service';

@ApiTags('Admin · Coupons')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/promotions/coupons')
export class AdminPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get() list(): Promise<CouponDto[]> {
    return this.promotions.listCoupons();
  }
  @Get(':id') get(@Param('id') id: string): Promise<CouponDto> {
    return this.promotions.getCoupon(id);
  }
  @Post() create(
    @Body() dto: CouponDtoIn,
    @CurrentUser('sub') actorId: string,
  ): Promise<CouponDto> {
    return this.promotions.createCoupon(dto, actorId);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: CouponDtoIn,
    @CurrentUser('sub') actorId: string,
  ): Promise<CouponDto> {
    return this.promotions.updateCoupon(id, dto, actorId);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<void> {
    return this.promotions.removeCoupon(id, actorId);
  }
}
