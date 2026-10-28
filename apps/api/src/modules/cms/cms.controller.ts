import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  PublicBannerDto,
  PublicFaqGroup,
  PublicMenuItem,
  PublicPageDto,
} from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { CmsService } from './cms.service';
import { BannerQueryDto } from './dto/banner.dto';

@ApiTags('CMS (storefront)')
@Public()
@Controller('cms')
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get('pages/:slug')
  page(@Param('slug') slug: string): Promise<PublicPageDto> {
    return this.cms.page(slug);
  }

  @Get('banners')
  banners(@Query() query: BannerQueryDto): Promise<PublicBannerDto[]> {
    return this.cms.banners(query.placement);
  }

  @Get('menus/:handle')
  menu(@Param('handle') handle: string): Promise<PublicMenuItem[]> {
    return this.cms.menu(handle);
  }

  @Get('faqs')
  faqs(): Promise<PublicFaqGroup[]> {
    return this.cms.faqs();
  }
}
