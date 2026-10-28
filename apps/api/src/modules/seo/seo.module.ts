import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

/** Sitemap data for the storefront. */
@Module({
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
