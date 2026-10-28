import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type AdminAttention, type AdminSalesReport } from '@ecommerce/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('Admin · Reports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales')
  sales(@Query() query: ReportQueryDto): Promise<AdminSalesReport> {
    return this.reports.adminSales(query);
  }

  @Get('attention')
  attention(): Promise<AdminAttention> {
    return this.reports.adminAttention();
  }
}
