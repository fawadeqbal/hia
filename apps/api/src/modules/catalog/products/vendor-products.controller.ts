import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type Paginated, type ProductDto, type ProductListItem } from '@ecommerce/types';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CreateProductDto,
  ManageProductQueryDto,
  SaveVariantsDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('Vendor · Products')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/products')
export class VendorProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(
    @CurrentUser('sub') userId: string,
    @Query() query: ManageProductQueryDto,
  ): Promise<Paginated<ProductListItem>> {
    return this.productsService.vendorList(userId, query); // vendorId is always forced to the caller's store
  }

  @Get(':id')
  get(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<ProductDto> {
    return this.productsService.vendorGet(userId, id);
  }

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateProductDto): Promise<ProductDto> {
    return this.productsService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDto> {
    return this.productsService.update(userId, id, dto);
  }

  /** Replace the full variant list (generated combinations). */
  @Put(':id/variants')
  saveVariants(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SaveVariantsDto,
  ): Promise<ProductDto> {
    return this.productsService.saveVariants(userId, id, dto.variants);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<ProductDto> {
    return this.productsService.submit(userId, id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<ProductDto> {
    return this.productsService.archive(userId, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<ProductDto> {
    return this.productsService.restore(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    return this.productsService.remove(userId, id);
  }
}
