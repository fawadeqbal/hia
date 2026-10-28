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
import { Role, type BannerDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { BannersService } from './banners.service';

@ApiTags('Admin · CMS banners')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.CONTENT_MANAGER)
@Controller('admin/cms/banners')
export class AdminBannersController {
  constructor(private readonly service: BannersService) {}

  @Get()
  list(): Promise<BannerDto[]> {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<BannerDto> {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: CreateBannerDto, @CurrentUser('sub') actorId: string): Promise<BannerDto> {
    return this.service.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<BannerDto> {
    return this.service.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.service.remove(id, actorId);
  }
}
