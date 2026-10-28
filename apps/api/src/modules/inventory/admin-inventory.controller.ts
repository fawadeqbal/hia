import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type LowStockRow, type Paginated } from '@ecommerce/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { LowStockQueryDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Admin · Inventory')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** Active variants at or below their low-stock threshold, lowest first. */
  @Get('low-stock')
  lowStock(@Query() query: LowStockQueryDto): Promise<Paginated<LowStockRow>> {
    return this.inventory.lowStock(query);
  }
}
