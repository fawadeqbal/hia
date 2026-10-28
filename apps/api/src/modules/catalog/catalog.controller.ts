import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import type {
  AttributeDto,
  CategoryTreeNode,
  Paginated,
  StorefrontProductCard,
  StorefrontProductDetail,
} from '@ecommerce/types';
import { AttributesService } from './attributes/attributes.service';
import { CatalogService } from './catalog.service';
import { DiscoveryService } from './discovery.service';
import { BySlugsQueryDto, RecordViewDto } from './dto/discovery.dto';
import { ProductQueryDto } from './dto/product-query.dto';

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly attributesService: AttributesService,
    private readonly discovery: DiscoveryService,
  ) {}

  @Public()
  @Get('products')
  listProducts(@Query() query: ProductQueryDto): Promise<Paginated<StorefrontProductCard>> {
    return this.catalogService.listProducts(query);
  }

  /** Declared before products/:slug so "by-slugs" is not read as a slug. */
  @Public()
  @Get('products/by-slugs')
  bySlugs(@Query() query: BySlugsQueryDto): Promise<StorefrontProductCard[]> {
    return this.discovery.bySlugs(query.slugs);
  }

  @Public()
  @Post('products/:slug/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  recordView(
    @Param('slug') slug: string,
    @Body() dto: RecordViewDto,
    @CurrentUser('sub') userId: string | undefined,
  ): Promise<void> {
    return this.discovery.recordView(slug, userId, dto.sessionId);
  }

  @Public()
  @Get('products/:slug')
  getProduct(@Param('slug') slug: string): Promise<StorefrontProductDetail> {
    return this.catalogService.getProduct(slug);
  }

  @Public()
  @Get('categories')
  categories(): Promise<CategoryTreeNode[]> {
    return this.catalogService.categoryTree();
  }

  @Public()
  @Get('attributes')
  attributes(): Promise<AttributeDto[]> {
    return this.attributesService.listFilterable();
  }

  /** Every attribute (used by the admin variant builder). */
  @Public()
  @Get('attributes/all')
  allAttributes(): Promise<AttributeDto[]> {
    return this.attributesService.list();
  }
}
