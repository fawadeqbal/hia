import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type CourierDto } from '@ecommerce/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { CouriersService } from './couriers.service';

@ApiTags('Seller · Shipping')
@ApiBearerAuth()
@Roles(Role.VENDOR, Role.ADMIN)
@Controller('vendor/shipping')
export class ShippingController {
  constructor(private readonly couriers: CouriersService) {}

  @Get('couriers')
  couriersList(): Promise<CourierDto[]> {
    return this.couriers.list(true);
  }
}
