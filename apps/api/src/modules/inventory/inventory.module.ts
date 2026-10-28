import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminInventoryController } from './admin-inventory.controller';
import { InventoryService } from './inventory.service';
import { VendorInventoryController } from './vendor-inventory.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [VendorInventoryController, AdminInventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
