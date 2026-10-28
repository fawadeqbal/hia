import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WishlistSweepService } from './wishlist-sweep.service';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [CartModule, NotificationsModule],
  controllers: [WishlistController],
  providers: [WishlistService, WishlistSweepService],
  exports: [WishlistService],
})
export class WishlistModule {}
