import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { ShippingModule } from '../shipping/shipping.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { LocalizationModule } from '../localization/localization.module';
import { CheckoutController } from './checkout.controller';
import { ManualOrderController } from './manual-order.controller';
import { ManualOrderService } from './manual-order.service';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [
    CartModule,
    NotificationsModule,
    PaymentsModule,
    ShippingModule,
    PromotionsModule,
    LoyaltyModule,
    LocalizationModule,
  ],
  controllers: [CheckoutController, ManualOrderController],
  providers: [CheckoutService, ManualOrderService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
