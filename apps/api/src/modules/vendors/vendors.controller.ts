import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { VendorPublicDto, VendorSelfDto } from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { setAuthCookies } from '../auth/auth-cookies';
import { AuthService } from '../auth/auth.service';
import { ApplyVendorDto } from './dto/vendor.dto';
import { VendorsService } from './vendors.service';

@ApiTags('Vendors')
@Controller('vendors')
export class VendorsController {
  constructor(
    private readonly vendorsService: VendorsService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** Seller application: creates the account + PENDING store and signs the user in (cookies). */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('apply')
  async apply(
    @Body() dto: ApplyVendorDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VendorSelfDto> {
    const { vendor, ownerId } = await this.vendorsService.apply(dto);
    const tokens = await this.authService.issueTokens(ownerId);
    setAuthCookies(res, tokens, this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30));
    return vendor;
  }

  /** Public store profile (approved vendors only). */
  @Public()
  @Get(':slug')
  get(@Param('slug') slug: string): Promise<VendorPublicDto> {
    return this.vendorsService.getPublic(slug);
  }
}
