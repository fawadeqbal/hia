import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { VendorPublicDto } from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { VendorsService } from './vendors.service';

/**
 * Single-shop build: the store is created by the seed and owned by the super admin, so there is
 * no public "apply to sell" route. `VendorsService.apply()` stays for tests and a future marketplace mode.
 */
@ApiTags('Vendors')
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  /** Public store profile (approved stores only). */
  @Public()
  @Get(':slug')
  get(@Param('slug') slug: string): Promise<VendorPublicDto> {
    return this.vendorsService.getPublic(slug);
  }
}
