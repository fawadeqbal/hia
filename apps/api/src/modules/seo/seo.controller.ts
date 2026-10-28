import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { SitemapDataDto } from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { SeoService } from './seo.service';

/** Storefront: sitemap data. */
@ApiTags('SEO')
@Public()
@Controller('seo')
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('sitemap')
  sitemap(): Promise<SitemapDataDto> {
    return this.seo.sitemap();
  }
}
