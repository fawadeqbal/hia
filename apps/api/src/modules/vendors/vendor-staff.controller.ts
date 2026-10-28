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
import { Role, type VendorStaffAccess, type VendorStaffDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { InviteVendorStaffDto, UpdateVendorStaffDto } from './dto/vendor-staff.dto';
import { VendorStaffService } from './vendor-staff.service';

@ApiTags('Vendor · Staff')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/staff')
export class VendorStaffController {
  constructor(private readonly staff: VendorStaffService) {}

  /** Owner or staff: what this account may open in the seller center. */
  @Get('me')
  me(@CurrentUser('sub') userId: string): Promise<VendorStaffAccess> {
    return this.staff.myAccess(userId);
  }

  @Get()
  list(@CurrentUser('sub') userId: string): Promise<VendorStaffDto[]> {
    return this.staff.list(userId);
  }

  @Post()
  invite(
    @CurrentUser('sub') userId: string,
    @Body() dto: InviteVendorStaffDto,
  ): Promise<VendorStaffDto> {
    return this.staff.invite(userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVendorStaffDto,
  ): Promise<VendorStaffDto> {
    return this.staff.update(userId, id, dto.permissions);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    return this.staff.remove(userId, id);
  }
}
