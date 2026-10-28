import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { DiscoveryService } from './discovery.service';
import { AdminAttributesController } from './attributes/admin-attributes.controller';
import { AttributesService } from './attributes/attributes.service';
import { AdminCategoriesController } from './categories/admin-categories.controller';
import { CategoriesService } from './categories/categories.service';
import { AdminProductsController } from './products/admin-products.controller';
import { VendorProductCsvController } from './products/product-csv.controller';
import { ProductCsvService } from './products/product-csv.service';
import { ProductsService } from './products/products.service';
import { VendorProductsController } from './products/vendor-products.controller';

@Module({
  controllers: [
    CatalogController,
    AdminCategoriesController,
    AdminAttributesController,
    VendorProductsController,
    AdminProductsController,
    VendorProductCsvController,
  ],
  providers: [
    CatalogService,
    CategoriesService,
    AttributesService,
    ProductsService,
    ProductCsvService,
    DiscoveryService,
  ],
  exports: [CatalogService, CategoriesService, AttributesService, ProductsService],
})
export class CatalogModule {}
