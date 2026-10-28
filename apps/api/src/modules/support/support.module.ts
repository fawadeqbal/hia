import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminInquiriesController } from './inquiries/admin-inquiries.controller';
import { InquiriesController } from './inquiries/inquiries.controller';
import { InquiriesService } from './inquiries/inquiries.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SupportController, InquiriesController, AdminInquiriesController],
  providers: [SupportService, InquiriesService],
  exports: [SupportService, InquiriesService],
})
export class SupportModule {}
