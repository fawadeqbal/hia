import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type CustomerDetail, type CustomerListResult } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CustomersService } from './customers.service';
import { BlockCustomerDto, CustomerQueryDto } from './dto/customer.dto';

@ApiTags('Admin · Customers')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT_AGENT, Role.MARKETING_MANAGER)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query() q: CustomerQueryDto): Promise<CustomerListResult> {
    return this.customers.list({
      page: q.page,
      limit: q.limit,
      search: q.search,
      segment: q.segment,
      status: q.status,
    });
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<CustomerDetail> {
    return this.customers.get(id);
  }

  /** Blocking is limited to admins and support agents. */
  @Post(':id/block')
  @Roles(Role.ADMIN, Role.SUPPORT_AGENT)
  block(
    @Param('id') id: string,
    @Body() dto: BlockCustomerDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<CustomerDetail> {
    return this.customers.block(id, dto.reason, actorId);
  }

  @Post(':id/unblock')
  @Roles(Role.ADMIN, Role.SUPPORT_AGENT)
  unblock(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<CustomerDetail> {
    return this.customers.unblock(id, actorId);
  }
}
