import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type ProductDto } from '@ecommerce/types';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FeatureProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';

/** Products are edited through the store routes (/vendor/products); only "show on the home page" is here. */
@ApiTags('Admin · Products')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Patch(':id/featured')
  setFeatured(
    @Param('id') id: string,
    @Body() dto: FeatureProductDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<ProductDto> {
    return this.productsService.setFeatured(id, dto.isFeatured, actorId);
  }
}
