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
import { Role, type FaqDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';
import { FaqsService } from './faqs.service';

@ApiTags('Admin · CMS FAQs')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.CONTENT_MANAGER)
@Controller('admin/cms/faqs')
export class AdminFaqsController {
  constructor(private readonly service: FaqsService) {}

  @Get()
  list(): Promise<FaqDto[]> {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateFaqDto, @CurrentUser('sub') actorId: string): Promise<FaqDto> {
    return this.service.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFaqDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<FaqDto> {
    return this.service.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.service.remove(id, actorId);
  }
}
