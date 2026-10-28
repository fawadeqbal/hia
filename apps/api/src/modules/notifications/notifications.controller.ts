import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@ecommerce/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

/**
 * Admin endpoints for email logs and templates.
 * TODO: template subject/content overrides, provider bounce/complaint webhook → EmailSuppression.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('email-logs')
  logs() {
    return this.notificationsService.listLogs();
  }
}
