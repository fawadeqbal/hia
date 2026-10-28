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
import { Role, type AttributeDto } from '@ecommerce/types';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AttributesService } from './attributes.service';
import { CreateAttributeDto, UpdateAttributeDto } from './dto/attribute.dto';

@ApiTags('Admin · Attributes')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/catalog/attributes')
export class AdminAttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  list(): Promise<AttributeDto[]> {
    return this.attributesService.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AttributeDto> {
    return this.attributesService.get(id);
  }

  @Post()
  create(
    @Body() dto: CreateAttributeDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<AttributeDto> {
    return this.attributesService.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<AttributeDto> {
    return this.attributesService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.attributesService.remove(id, actorId);
  }
}
