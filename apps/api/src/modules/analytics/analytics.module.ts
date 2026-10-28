import { Module } from '@nestjs/common';
import { AdminReportsController } from './admin-reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class AnalyticsModule {}
