import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  BlogCategoryDto,
  Paginated,
  PublicBlogCard,
  PublicBlogPost,
  SitemapEntries,
} from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { BlogService } from './blog.service';
import { BlogQueryDto } from './dto/blog.dto';

@ApiTags('CMS (storefront)')
@Public()
@Controller('cms')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get('blog')
  posts(@Query() query: BlogQueryDto): Promise<Paginated<PublicBlogCard>> {
    return this.blog.publicPosts({
      page: query.page,
      limit: query.limit,
      category: query.category,
      tag: query.tag,
    });
  }

  @Get('blog/categories')
  categories(): Promise<BlogCategoryDto[]> {
    return this.blog.publicCategories();
  }

  @Get('blog/posts/:slug')
  post(@Param('slug') slug: string): Promise<PublicBlogPost> {
    return this.blog.publicPost(slug);
  }

  @Get('sitemap')
  sitemap(): Promise<SitemapEntries> {
    return this.blog.sitemap();
  }
}
