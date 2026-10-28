import { Module } from '@nestjs/common';
import { EmailAdminController } from './email-admin.controller';
import { EmailAdminService } from './email-admin.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController, EmailAdminController],
  providers: [NotificationsService, EmailAdminService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
