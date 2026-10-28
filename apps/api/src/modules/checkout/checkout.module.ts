import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { ShippingModule } from '../shipping/shipping.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { ManualOrderController } from './manual-order.controller';
import { ManualOrderService } from './manual-order.service';

@Module({
  imports: [CartModule, NotificationsModule, PaymentsModule, ShippingModule, PromotionsModule],
  controllers: [CheckoutController, ManualOrderController],
  providers: [CheckoutService, ManualOrderService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
