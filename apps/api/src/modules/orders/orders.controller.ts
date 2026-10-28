import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { OrderDto, OrderSummaryDto, Paginated } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CancelOrderDto, OrderQueryDto, TrackOrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Guest order tracking (order number + email). Declared before :orderNumber. */
  @Public()
  @Post('track')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  track(@Body() dto: TrackOrderDto): Promise<OrderDto> {
    return this.orders.track(dto.orderNumber, dto.email);
  }

  @Get()
  mine(
    @CurrentUser('sub') userId: string,
    @Query() query: OrderQueryDto,
  ): Promise<Paginated<OrderSummaryDto>> {
    return this.orders.listMine(userId, query);
  }

  @Get(':orderNumber')
  get(
    @CurrentUser('sub') userId: string,
    @Param('orderNumber') orderNumber: string,
  ): Promise<OrderDto> {
    return this.orders.getMine(userId, orderNumber);
  }

  @Post(':orderNumber/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser('sub') userId: string,
    @Param('orderNumber') orderNumber: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderDto> {
    return this.orders.cancelMine(userId, orderNumber, dto.reason);
  }
}
