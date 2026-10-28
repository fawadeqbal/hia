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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type CommissionPreviewDto, type CommissionRuleDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CommissionsService } from './commissions.service';
import {
  CommissionPreviewQueryDto,
  CommissionRuleDtoIn,
  UpdateCommissionRuleDto,
} from './dto/commission.dto';

/** Registered before AdminVendorsController so `commissions` isn't read as a vendor id. */
@ApiTags('Admin · Commissions')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/vendors/commissions')
export class AdminCommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get()
  list(): Promise<CommissionRuleDto[]> {
    return this.commissions.list();
  }

  @Get('preview')
  preview(@Query() q: CommissionPreviewQueryDto): Promise<CommissionPreviewDto> {
    return this.commissions.preview(q);
  }

  @Post()
  create(
    @Body() dto: CommissionRuleDtoIn,
    @CurrentUser('sub') actorId: string,
  ): Promise<CommissionRuleDto> {
    return this.commissions.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommissionRuleDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<CommissionRuleDto> {
    return this.commissions.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.commissions.remove(id, actorId);
  }
}
