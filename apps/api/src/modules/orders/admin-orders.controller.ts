import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type AdminOrderListItem, type OrderDto, type Paginated } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CancelOrderDto, OrderQueryDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Admin · Orders')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT_AGENT)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: OrderQueryDto): Promise<Paginated<AdminOrderListItem>> {
    return this.orders.adminList(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<OrderDto> {
    return this.orders.adminGet(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<OrderDto> {
    return this.orders.adminCancel(id, dto.reason, actorId);
  }
}
