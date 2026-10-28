import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type ManualOrderResult } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ManualOrderDto } from './dto/manual-order.dto';
import { ManualOrderService } from './manual-order.service';

@ApiTags('Admin · Manual orders')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT_AGENT)
@Controller('admin/manual-orders')
export class ManualOrderController {
  constructor(private readonly manual: ManualOrderService) {}

  @Post()
  create(
    @Body() dto: ManualOrderDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<ManualOrderResult> {
    return this.manual.create(dto, actorId);
  }
}
