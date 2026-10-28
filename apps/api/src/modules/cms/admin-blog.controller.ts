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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  type BlogCategoryDto,
  type BlogPostDto,
  type BlogPostListItem,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BlogService } from './blog.service';
import {
  CreateBlogCategoryDto,
  CreateBlogPostDto,
  UpdateBlogCategoryDto,
  UpdateBlogPostDto,
} from './dto/blog.dto';

@ApiTags('Admin · CMS blog')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.CONTENT_MANAGER)
@Controller('admin/cms/blog')
export class AdminBlogController {
  constructor(private readonly blog: BlogService) {}

  @Get('posts')
  posts(): Promise<BlogPostListItem[]> {
    return this.blog.listPosts();
  }

  @Get('posts/:id')
  post(@Param('id') id: string): Promise<BlogPostDto> {
    return this.blog.getPost(id);
  }

  @Post('posts')
  createPost(
    @Body() dto: CreateBlogPostDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<BlogPostDto> {
    return this.blog.createPost(dto, actorId);
  }

  @Patch('posts/:id')
  updatePost(
    @Param('id') id: string,
    @Body() dto: UpdateBlogPostDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<BlogPostDto> {
    return this.blog.updatePost(id, dto, actorId);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePost(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.blog.removePost(id, actorId);
  }

  @Get('categories')
  categories(): Promise<BlogCategoryDto[]> {
    return this.blog.listCategories();
  }

  @Post('categories')
  createCategory(
    @Body() dto: CreateBlogCategoryDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<BlogCategoryDto> {
    return this.blog.createCategory(dto, actorId);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateBlogCategoryDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<BlogCategoryDto> {
    return this.blog.updateCategory(id, dto, actorId);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCategory(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.blog.removeCategory(id, actorId);
  }
}
