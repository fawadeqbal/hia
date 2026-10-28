import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type CsvExportDto, type ProductImportResult } from '@ecommerce/types';
import { ImportRowsDto } from '../../../common/dto/import.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ProductCsvService } from './product-csv.service';

@ApiTags('Shop · Product Excel')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/products-csv')
export class VendorProductCsvController {
  constructor(private readonly csv: ProductCsvService) {}

  @Get()
  export(@CurrentUser('sub') userId: string): Promise<CsvExportDto> {
    return this.csv.vendorExport(userId);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(
    @CurrentUser('sub') userId: string,
    @Body() dto: ImportRowsDto,
  ): Promise<ProductImportResult> {
    return this.csv.vendorImport(userId, dto.rows, dto.dryRun);
  }
}
