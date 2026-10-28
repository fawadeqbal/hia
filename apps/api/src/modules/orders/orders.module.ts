import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminOrdersController } from './admin-orders.controller';
import {
  AdminDocumentsController,
  CustomerDocumentsController,
} from './documents/documents.controller';
import { DocumentsService } from './documents/documents.service';
import { OrderNotesService } from './documents/notes.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReorderController } from './reorder.controller';
import { VendorOrdersController } from './vendor-orders.controller';

@Module({
  imports: [NotificationsModule, PaymentsModule, CartModule],
  controllers: [
    OrdersController,
    VendorOrdersController,
    AdminOrdersController,
    CustomerDocumentsController,
    AdminDocumentsController,
    ReorderController,
  ],
  providers: [OrdersService, DocumentsService, OrderNotesService],
  exports: [OrdersService],
})
export class OrdersModule {}
