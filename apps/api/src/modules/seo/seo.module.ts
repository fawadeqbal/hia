import { Module } from '@nestjs/common';
import { AdminSeoController, SeoController } from './seo.controller';
import { SeoService } from './seo.service';

/** Redirects and sitemap data. */
@Module({
  controllers: [SeoController, AdminSeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
