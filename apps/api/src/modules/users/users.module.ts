import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AdminCustomersController } from './admin-customers.controller';
import { CustomersService } from './customers.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [NotificationsModule],
  controllers: [UsersController, AccountController, AdminCustomersController],
  providers: [UsersService, AccountService, CustomersService],
  exports: [UsersService, CustomersService],
})
export class UsersModule {}
