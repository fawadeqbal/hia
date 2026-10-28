import { Module } from '@nestjs/common';
import { AdminPromotionsController, VendorCouponsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({
  controllers: [AdminPromotionsController, VendorCouponsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
