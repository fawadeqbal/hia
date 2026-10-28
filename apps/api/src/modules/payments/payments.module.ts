import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PaymentGatewaysService } from './gateways.service';
import { MockGatewayController } from './mock-gateway.controller';
import { PaymentAdminController } from './payment-admin.controller';
import { PaymentExpiryService } from './payment-expiry.service';
import { PaymentLogsService } from './payment-logs.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [NotificationsModule, LoyaltyModule],
  controllers: [MockGatewayController, PaymentsController, PaymentAdminController],
  providers: [PaymentGatewaysService, PaymentsService, PaymentLogsService, PaymentExpiryService],
  exports: [PaymentsService, PaymentGatewaysService],
})
export class PaymentsModule {}
