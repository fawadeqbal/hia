import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  type Paginated,
  type VendorOrderDetailDto,
  type VendorOrderListItem,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrderQueryDto, VendorOrderStatusDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Vendor · Orders')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/orders')
export class VendorOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @CurrentUser('sub') userId: string,
    @Query() query: OrderQueryDto,
  ): Promise<Paginated<VendorOrderListItem>> {
    return this.orders.vendorList(userId, query);
  }

  @Get(':id')
  get(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<VendorOrderDetailDto> {
    return this.orders.vendorGet(userId, id);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: VendorOrderStatusDto,
  ): Promise<VendorOrderDetailDto> {
    return this.orders.vendorUpdateStatus(userId, id, dto);
  }
}
