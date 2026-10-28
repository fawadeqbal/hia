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
import { Role, type CategoryDto, type CategoryListItem } from '@ecommerce/types';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('Admin · Categories')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/catalog/categories')
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(): Promise<CategoryListItem[]> {
    return this.categoriesService.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<CategoryDto> {
    return this.categoriesService.get(id);
  }

  @Post()
  create(
    @Body() dto: CreateCategoryDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<CategoryDto> {
    return this.categoriesService.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<CategoryDto> {
    return this.categoriesService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.categoriesService.remove(id, actorId);
  }
}
