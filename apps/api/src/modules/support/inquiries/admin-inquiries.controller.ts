import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, type InquiryDto, type InquiryListItem, type Paginated } from '@ecommerce/types';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InquiryNoteDto, InquiryQueryDto, InquiryStatusDto } from './dto/inquiry.dto';
import { InquiriesService } from './inquiries.service';

@ApiTags('Admin · Inquiries')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT_AGENT)
@Controller('admin/inquiries')
export class AdminInquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  list(@Query() query: InquiryQueryDto): Promise<Paginated<InquiryListItem>> {
    return this.inquiries.adminList({
      page: query.page,
      limit: query.limit,
      status: query.status,
      topic: query.topic,
      search: query.search,
    });
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<InquiryDto> {
    return this.inquiries.adminGet(id);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: InquiryStatusDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<InquiryDto> {
    return this.inquiries.setStatus(id, dto.status, actorId);
  }

  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: InquiryNoteDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<InquiryDto> {
    return this.inquiries.addNote(id, dto.body, actorId);
  }
}
