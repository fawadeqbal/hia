import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  type ImportResult,
  type Paginated,
  type StockMovementDto,
  type StockRow,
  type WarehouseDto,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateWarehouseDto,
  MovementQueryDto,
  StockAdjustDto,
  StockImportDto,
  StockQueryDto,
  UpdateWarehouseDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Vendor · Inventory')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/inventory')
export class VendorInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('warehouses')
  warehouses(@CurrentUser('sub') userId: string): Promise<WarehouseDto[]> {
    return this.inventory.listWarehouses(userId);
  }

  @Post('warehouses')
  createWarehouse(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateWarehouseDto,
  ): Promise<WarehouseDto> {
    return this.inventory.createWarehouse(userId, dto);
  }

  @Patch('warehouses/:id')
  updateWarehouse(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ): Promise<WarehouseDto> {
    return this.inventory.updateWarehouse(userId, id, dto);
  }

  @Get('stock')
  stock(
    @CurrentUser('sub') userId: string,
    @Query() query: StockQueryDto,
  ): Promise<Paginated<StockRow>> {
    return this.inventory.listStock(userId, query);
  }

  @Post('stock/adjust')
  @HttpCode(HttpStatus.OK)
  adjust(@CurrentUser('sub') userId: string, @Body() dto: StockAdjustDto): Promise<StockRow> {
    return this.inventory.adjust(userId, dto);
  }

  /** Excel upload: dryRun = check only; otherwise saves when every row is valid. */
  @Post('stock/import')
  @HttpCode(HttpStatus.OK)
  importStock(
    @CurrentUser('sub') userId: string,
    @Body() dto: StockImportDto,
  ): Promise<ImportResult> {
    return this.inventory.importStock(userId, dto);
  }

  @Get('movements')
  movements(
    @CurrentUser('sub') userId: string,
    @Query() query: MovementQueryDto,
  ): Promise<Paginated<StockMovementDto>> {
    return this.inventory.movements(userId, query);
  }
}
