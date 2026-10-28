import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Paginated, ReturnListItem, ReturnRequestDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateReturnDto, ReturnQueryDto } from './dto/return.dto';
import { ReturnsService } from './returns.service';

/** Signed-in customers: request, follow and withdraw returns. */
@ApiTags('Returns')
@ApiBearerAuth()
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  mine(
    @CurrentUser('sub') userId: string,
    @Query() query: ReturnQueryDto,
  ): Promise<Paginated<ReturnListItem>> {
    return this.returns.listMine(userId, query);
  }

  @Post()
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateReturnDto,
  ): Promise<ReturnRequestDto> {
    return this.returns.create(userId, dto);
  }

  @Get(':rmaNumber')
  get(
    @CurrentUser('sub') userId: string,
    @Param('rmaNumber') rma: string,
  ): Promise<ReturnRequestDto> {
    return this.returns.getMine(userId, rma);
  }

  @Post(':rmaNumber/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser('sub') userId: string,
    @Param('rmaNumber') rma: string,
  ): Promise<ReturnRequestDto> {
    return this.returns.cancelMine(userId, rma);
  }
}
