import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { Role, type PublicStoreSettings, type SettingsDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';

export class SaveSettingsDto {
  @ApiProperty({ example: { 'store.name': 'My Store', 'store.maintenanceMode': false } })
  @IsObject()
  values: Record<string, unknown>;
}

@ApiTags('Settings')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Storefront: store name, contact details, maintenance mode. */
  @Public()
  @Get('settings/public')
  publicSettings(): Promise<PublicStoreSettings> {
    return this.settings.publicSettings();
  }

  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  @Get('admin/settings')
  getAll(): Promise<SettingsDto> {
    return this.settings.getAll();
  }

  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  @Put('admin/settings')
  save(@Body() dto: SaveSettingsDto, @CurrentUser('sub') actorId: string): Promise<SettingsDto> {
    return this.settings.save(dto.values, actorId);
  }
}
