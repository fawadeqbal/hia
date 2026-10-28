import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminInquiriesController } from './inquiries/admin-inquiries.controller';
import { InquiriesController } from './inquiries/inquiries.controller';
import { InquiriesService } from './inquiries/inquiries.service';

/** Website inquiries (Contact page) and the admin Inquiries inbox. */
@Module({
  imports: [NotificationsModule],
  controllers: [InquiriesController, AdminInquiriesController],
  providers: [InquiriesService],
  exports: [InquiriesService],
})
export class SupportModule {}
