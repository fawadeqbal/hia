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
import { Role, type Paginated, type ProductDto, type ProductListItem } from '@ecommerce/types';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FeatureProductDto, ManageProductQueryDto, RejectProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('Admin · Products')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: ManageProductQueryDto): Promise<Paginated<ProductListItem>> {
    return this.productsService.adminList(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<ProductDto> {
    return this.productsService.adminGet(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<ProductDto> {
    return this.productsService.approve(id, actorId);
  }

  /** Reject a product in review, or take down a published one. */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectProductDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<ProductDto> {
    return this.productsService.reject(id, dto.reason, actorId);
  }

  @Patch(':id/featured')
  setFeatured(
    @Param('id') id: string,
    @Body() dto: FeatureProductDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<ProductDto> {
    return this.productsService.setFeatured(id, dto.isFeatured, actorId);
  }
}
