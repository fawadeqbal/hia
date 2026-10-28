import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  type Paginated,
  type PaymentGatewayDto,
  type PaymentLogDetail,
  type PaymentLogItem,
  type WebhookLogDetail,
  type WebhookLogItem,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentLogQueryDto, SaveGatewayDto, WebhookLogQueryDto } from './dto/payment-admin.dto';
import { PaymentGatewaysService } from './gateways.service';
import { PaymentLogsService } from './payment-logs.service';

/** Settings area: SUPER_ADMIN, or custom roles with the settings permission. */
@ApiTags('Admin · Payments')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('admin/settings/payments')
export class PaymentAdminController {
  constructor(
    private readonly gateways: PaymentGatewaysService,
    private readonly logs: PaymentLogsService,
  ) {}

  @Get('gateways')
  list(): Promise<PaymentGatewayDto[]> {
    return this.gateways.list();
  }

  @Put('gateways/:code')
  save(
    @Param('code') code: string,
    @Body() dto: SaveGatewayDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<PaymentGatewayDto> {
    return this.gateways.save(code, dto, actorId);
  }

  @Get('log')
  payments(@Query() q: PaymentLogQueryDto): Promise<Paginated<PaymentLogItem>> {
    return this.logs.payments({
      status: q.status,
      method: q.method,
      search: q.search,
      page: q.page,
      limit: q.limit,
    });
  }

  @Get('log/:id')
  payment(@Param('id') id: string): Promise<PaymentLogDetail> {
    return this.logs.payment(id);
  }

  @Get('webhooks')
  webhooks(@Query() q: WebhookLogQueryDto): Promise<Paginated<WebhookLogItem>> {
    return this.logs.webhooks({ status: q.status, search: q.search, page: q.page, limit: q.limit });
  }

  @Get('webhooks/:id')
  webhook(@Param('id') id: string): Promise<WebhookLogDetail> {
    return this.logs.webhook(id);
  }
}
