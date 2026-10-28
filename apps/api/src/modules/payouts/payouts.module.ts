import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminPayoutsController, VendorPayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [NotificationsModule],
  controllers: [VendorPayoutsController, AdminPayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
