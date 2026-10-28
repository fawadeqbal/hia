import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type MenuDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SaveMenuDto } from './dto/menu.dto';
import { MenusService } from './menus.service';

@ApiTags('Admin · CMS menus')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.CONTENT_MANAGER)
@Controller('admin/cms/menus')
export class AdminMenusController {
  constructor(private readonly menus: MenusService) {}

  @Get()
  list(): Promise<MenuDto[]> {
    return this.menus.list();
  }

  @Get(':handle')
  get(@Param('handle') handle: string): Promise<MenuDto> {
    return this.menus.get(handle);
  }

  @Put(':handle')
  save(
    @Param('handle') handle: string,
    @Body() dto: SaveMenuDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<MenuDto> {
    return this.menus.save(handle, dto, actorId);
  }
}
