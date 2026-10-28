import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type VendorAttention, type VendorSalesReport } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('Vendor · Reports')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/reports')
export class VendorReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales')
  sales(
    @CurrentUser('sub') userId: string,
    @Query() query: ReportQueryDto,
  ): Promise<VendorSalesReport> {
    return this.reports.vendorSales(userId, query);
  }

  @Get('attention')
  attention(@CurrentUser('sub') userId: string): Promise<VendorAttention> {
    return this.reports.vendorAttention(userId);
  }
}
