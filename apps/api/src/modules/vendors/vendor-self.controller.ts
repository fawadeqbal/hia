import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type VendorSelfDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateVendorPayoutDto, UpdateVendorProfileDto } from './dto/vendor.dto';
import { VendorsService } from './vendors.service';

/** The signed-in seller's own store. Works while PENDING so sellers can finish their profile. */
@ApiTags('Vendor · My store')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/me')
export class VendorSelfController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  get(@CurrentUser('sub') userId: string): Promise<VendorSelfDto> {
    return this.vendorsService.getSelf(userId);
  }

  @Patch()
  updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateVendorProfileDto,
  ): Promise<VendorSelfDto> {
    return this.vendorsService.updateProfile(userId, dto);
  }

  @Put('payout')
  updatePayout(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateVendorPayoutDto,
  ): Promise<VendorSelfDto> {
    return this.vendorsService.updatePayout(userId, dto);
  }
}
