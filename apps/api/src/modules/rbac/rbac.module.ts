import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminRbacController, RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [RbacController, AdminRbacController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
