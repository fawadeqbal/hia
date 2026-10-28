import { Module } from '@nestjs/common';
import { AdminReportsController } from './admin-reports.controller';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ReportsService } from './reports.service';
import { VendorReportsController } from './vendor-reports.controller';

@Module({
  controllers: [AnalyticsController, AdminReportsController, VendorReportsController],
  providers: [AnalyticsService, ReportsService],
  exports: [AnalyticsService, ReportsService],
})
export class AnalyticsModule {}
