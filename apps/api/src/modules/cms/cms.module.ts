import { Module } from '@nestjs/common';
import { AdminBannersController } from './admin-banners.controller';
import { AdminFaqsController } from './admin-faqs.controller';
import { AdminMenusController } from './admin-menus.controller';
import { AdminPagesController } from './admin-pages.controller';
import { BannersService } from './banners.service';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { FaqsService } from './faqs.service';
import { MenusService } from './menus.service';
import { PagesService } from './pages.service';

@Module({
  controllers: [
    CmsController,
    AdminPagesController,
    AdminBannersController,
    AdminMenusController,
    AdminFaqsController,
  ],
  providers: [CmsService, PagesService, BannersService, MenusService, FaqsService],
  exports: [CmsService],
})
export class CmsModule {}
