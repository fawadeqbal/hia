import { Module } from '@nestjs/common';
import { AdminShippingController } from './admin-shipping.controller';
import { CouriersService } from './couriers.service';
import { ShippingZonesService } from './shipping-zones.service';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  controllers: [AdminShippingController, ShippingController],
  providers: [ShippingService, ShippingZonesService, CouriersService],
  exports: [ShippingService],
})
export class ShippingModule {}
