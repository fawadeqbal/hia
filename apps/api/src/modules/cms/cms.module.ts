import { Module } from '@nestjs/common';
import { AdminBannersController } from './admin-banners.controller';
import { AdminBlogController } from './admin-blog.controller';
import { AdminFaqsController } from './admin-faqs.controller';
import { AdminMenusController } from './admin-menus.controller';
import { AdminPagesController } from './admin-pages.controller';
import { BannersService } from './banners.service';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { FaqsService } from './faqs.service';
import { MenusService } from './menus.service';
import { PagesService } from './pages.service';

@Module({
  controllers: [
    CmsController,
    BlogController,
    AdminPagesController,
    AdminBannersController,
    AdminMenusController,
    AdminFaqsController,
    AdminBlogController,
  ],
  providers: [CmsService, PagesService, BannersService, MenusService, FaqsService, BlogService],
  exports: [CmsService, BlogService],
})
export class CmsModule {}
