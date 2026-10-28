import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  type EmailLogItem,
  type EmailPreviewDto,
  type EmailSuppressionDto,
  type EmailTemplateDetail,
  type EmailTemplateListItem,
  type Paginated,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmailAddressDto, EmailLogQueryDto, EmailTemplateBody } from './dto/email-admin.dto';
import { EmailAdminService } from './email-admin.service';

/** Settings area: SUPER_ADMIN, or custom roles with the settings permission. */
@ApiTags('Admin · Emails')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('admin/settings/emails')
export class EmailAdminController {
  constructor(private readonly emails: EmailAdminService) {}

  @Get('templates')
  list(): Promise<EmailTemplateListItem[]> {
    return this.emails.list();
  }

  @Get('templates/:key')
  get(@Param('key') key: string): Promise<EmailTemplateDetail> {
    return this.emails.get(key);
  }

  @Put('templates/:key')
  save(
    @Param('key') key: string,
    @Body() dto: EmailTemplateBody,
    @CurrentUser('sub') actorId: string,
  ): Promise<EmailTemplateDetail> {
    return this.emails.save(key, dto, actorId);
  }

  @Delete('templates/:key')
  reset(
    @Param('key') key: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<EmailTemplateDetail> {
    return this.emails.reset(key, actorId);
  }

  @Post('templates/:key/preview')
  @HttpCode(HttpStatus.OK)
  preview(@Param('key') key: string, @Body() dto: EmailTemplateBody): Promise<EmailPreviewDto> {
    return this.emails.preview(key, dto);
  }

  @Post('templates/:key/test')
  @HttpCode(HttpStatus.OK)
  test(@Param('key') key: string, @Body() dto: EmailAddressDto): Promise<{ message: string }> {
    return this.emails.sendTest(key, dto.email);
  }

  @Get('log')
  logs(@Query() q: EmailLogQueryDto): Promise<Paginated<EmailLogItem>> {
    return this.emails.logs({
      status: q.status,
      template: q.template,
      search: q.search,
      page: q.page,
      limit: q.limit,
    });
  }

  @Get('suppressions')
  suppressions(): Promise<EmailSuppressionDto[]> {
    return this.emails.suppressions();
  }

  @Post('suppressions')
  addSuppression(
    @Body() dto: EmailAddressDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<EmailSuppressionDto> {
    return this.emails.addSuppression(dto.email, actorId);
  }

  @Delete('suppressions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSuppression(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.emails.removeSuppression(id, actorId);
  }
}
