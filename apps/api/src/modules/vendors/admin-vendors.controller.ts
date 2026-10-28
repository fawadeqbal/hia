import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type Paginated, type VendorAdminDto, type VendorListItem } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AdminUpdateVendorDto,
  ApproveVendorDto,
  VendorQueryDto,
  VendorReasonDto,
} from './dto/vendor.dto';
import { VendorsService } from './vendors.service';

@ApiTags('Admin · Vendors')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/vendors')
export class AdminVendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  list(@Query() query: VendorQueryDto): Promise<Paginated<VendorListItem>> {
    return this.vendorsService.adminList(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<VendorAdminDto> {
    return this.vendorsService.adminGet(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateVendorDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<VendorAdminDto> {
    return this.vendorsService.adminUpdate(id, dto, actorId);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveVendorDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<VendorAdminDto> {
    return this.vendorsService.approve(id, dto, actorId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id') id: string,
    @Body() dto: VendorReasonDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<VendorAdminDto> {
    return this.vendorsService.reject(id, dto.reason, actorId);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(
    @Param('id') id: string,
    @Body() dto: VendorReasonDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<VendorAdminDto> {
    return this.vendorsService.suspend(id, dto.reason, actorId);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<VendorAdminDto> {
    return this.vendorsService.reactivate(id, actorId);
  }
}
