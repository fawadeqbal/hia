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
import { Role, type CourierDto, type ShippingZoneDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CouriersService } from './couriers.service';
import {
  CreateCourierDto,
  CreateZoneDto,
  UpdateCourierDto,
  UpdateZoneDto,
} from './dto/shipping.dto';
import { ShippingZonesService } from './shipping-zones.service';

@ApiTags('Admin · Shipping')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/shipping')
export class AdminShippingController {
  constructor(
    private readonly zones: ShippingZonesService,
    private readonly couriers: CouriersService,
  ) {}

  // ---------------------------------------------------------------- couriers (fixed paths first)
  @Get('couriers')
  listCouriers(): Promise<CourierDto[]> {
    return this.couriers.list();
  }

  @Post('couriers')
  createCourier(
    @Body() dto: CreateCourierDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<CourierDto> {
    return this.couriers.create(dto, actorId);
  }

  @Patch('couriers/:id')
  updateCourier(
    @Param('id') id: string,
    @Body() dto: UpdateCourierDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<CourierDto> {
    return this.couriers.update(id, dto, actorId);
  }

  @Delete('couriers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCourier(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.couriers.remove(id, actorId);
  }

  // ---------------------------------------------------------------- zones
  @Get('zones')
  listZones(): Promise<ShippingZoneDto[]> {
    return this.zones.list();
  }

  @Get('zones/:id')
  getZone(@Param('id') id: string): Promise<ShippingZoneDto> {
    return this.zones.get(id);
  }

  @Post('zones')
  createZone(
    @Body() dto: CreateZoneDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<ShippingZoneDto> {
    return this.zones.create(dto, actorId);
  }

  @Patch('zones/:id')
  updateZone(
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<ShippingZoneDto> {
    return this.zones.update(id, dto, actorId);
  }

  @Delete('zones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeZone(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.zones.remove(id, actorId);
  }
}
