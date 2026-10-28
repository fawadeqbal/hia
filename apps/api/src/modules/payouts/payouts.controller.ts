import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  type GeneratePayoutsResultDto,
  type PayoutDto,
  type VendorEarningsDto,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MarkPayoutDto, PayoutQueryDto } from './dto/payout.dto';
import { PayoutsService } from './payouts.service';

@ApiTags('Seller · Payouts')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/payouts')
export class VendorPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('earnings') earnings(@CurrentUser('sub') userId: string): Promise<VendorEarningsDto> {
    return this.payouts.earnings(userId);
  }
  @Get() list(@CurrentUser('sub') userId: string): Promise<PayoutDto[]> {
    return this.payouts.vendorList(userId);
  }
  @Get(':id') get(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<PayoutDto> {
    return this.payouts.vendorGet(userId, id);
  }
}

@ApiTags('Admin · Payouts')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/payouts')
export class AdminPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get() list(@Query() q: PayoutQueryDto): Promise<PayoutDto[]> {
    return this.payouts.adminList(q.status);
  }
  @Post('generate') @HttpCode(HttpStatus.OK) generate(
    @CurrentUser('sub') actorId: string,
  ): Promise<GeneratePayoutsResultDto> {
    return this.payouts.generate(actorId);
  }
  @Get(':id') get(@Param('id') id: string): Promise<PayoutDto> {
    return this.payouts.adminGet(id);
  }
  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  mark(
    @Param('id') id: string,
    @Body() dto: MarkPayoutDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<PayoutDto> {
    return this.payouts.mark(id, dto, actorId);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) cancel(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<void> {
    return this.payouts.cancel(id, actorId);
  }
}
