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
import { Role, type PageDto, type PageListItem } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';
import { PagesService } from './pages.service';

@ApiTags('Admin · CMS pages')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.CONTENT_MANAGER)
@Controller('admin/cms/pages')
export class AdminPagesController {
  constructor(private readonly service: PagesService) {}

  @Get()
  list(): Promise<PageListItem[]> {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<PageDto> {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: CreatePageDto, @CurrentUser('sub') actorId: string): Promise<PageDto> {
    return this.service.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<PageDto> {
    return this.service.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.service.remove(id, actorId);
  }
}
