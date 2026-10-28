import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type Paginated, type ReturnListItem, type ReturnRequestDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ReceiveReturnDto,
  RefundReturnDto,
  ReturnDecisionDto,
  ReturnQueryDto,
} from './dto/return.dto';
import { ReturnsService } from './returns.service';

@ApiTags('Seller · Returns')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/returns')
export class VendorReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  async list(
    @CurrentUser('sub') userId: string,
    @Query() query: ReturnQueryDto,
  ): Promise<Paginated<ReturnListItem>> {
    return this.returns.staffList(await this.scope(userId), query);
  }

  @Get(':id')
  async get(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<ReturnRequestDto> {
    return this.returns.staffGet(await this.scope(userId), id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ReturnDecisionDto,
  ): Promise<ReturnRequestDto> {
    return this.returns.approve(await this.scope(userId), id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ReturnDecisionDto,
  ): Promise<ReturnRequestDto> {
    return this.returns.reject(await this.scope(userId), id, dto);
  }

  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  async receive(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ReceiveReturnDto,
  ): Promise<ReturnRequestDto> {
    return this.returns.receive(await this.scope(userId), id, dto);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  async refund(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: RefundReturnDto,
  ): Promise<ReturnRequestDto> {
    return this.returns.refund(await this.scope(userId), id, dto);
  }

  private async scope(userId: string) {
    return this.returns.vendorScope(userId);
  }
}
