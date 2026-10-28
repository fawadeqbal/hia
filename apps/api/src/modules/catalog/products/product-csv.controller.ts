import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength } from 'class-validator';
import {
  Role,
  type CsvExportDto,
  type ProductImportInput,
  type ProductImportResult,
} from '@ecommerce/types';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ProductCsvService } from './product-csv.service';

export class ProductImportDto implements ProductImportInput {
  @ApiProperty() @IsString() @MaxLength(5_000_000) csv: string;
  @ApiProperty() @IsBoolean() dryRun: boolean;
}

@ApiTags('Vendor · Product CSV')
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
    @Body() dto: ProductImportDto,
  ): Promise<ProductImportResult> {
    return this.csv.vendorImport(userId, dto.csv, dto.dryRun);
  }
}

@ApiTags('Admin · Product CSV')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/products-csv')
export class AdminProductCsvController {
  constructor(private readonly csv: ProductCsvService) {}

  @Get()
  export(): Promise<CsvExportDto> {
    return this.csv.adminExport();
  }
}
