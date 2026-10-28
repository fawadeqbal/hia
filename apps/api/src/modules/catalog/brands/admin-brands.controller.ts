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
import { Role, type BrandDto, type BrandListItem } from '@ecommerce/types';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { BrandsService } from './brands.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

@ApiTags('Admin · Brands')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/catalog/brands')
export class AdminBrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  list(): Promise<BrandListItem[]> {
    return this.brandsService.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<BrandDto> {
    return this.brandsService.get(id);
  }

  @Post()
  create(@Body() dto: CreateBrandDto, @CurrentUser('sub') actorId: string): Promise<BrandDto> {
    return this.brandsService.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<BrandDto> {
    return this.brandsService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.brandsService.remove(id, actorId);
  }
}
