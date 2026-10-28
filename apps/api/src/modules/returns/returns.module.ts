import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminReturnsController } from './admin-returns.controller';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { VendorReturnsController } from './vendor-returns.controller';

@Module({
  imports: [NotificationsModule, InventoryModule, PaymentsModule],
  controllers: [ReturnsController, VendorReturnsController, AdminReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
