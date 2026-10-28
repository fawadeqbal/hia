import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { EmailPreferencesDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { REFRESH_COOKIE, clearAuthCookies } from '../auth/auth-cookies';
import { AccountService } from './account.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  EmailPreferencesBody,
  UpdateProfileDto,
} from './dto/account.dto';

@ApiTags('Users · Account')
@ApiBearerAuth()
@Controller('users/me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Patch()
  updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.account.updateProfile(userId, dto);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    const current = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    return this.account.changePassword(userId, dto, current);
  }

  @Get('email-preferences')
  emailPreferences(@CurrentUser('sub') userId: string): Promise<EmailPreferencesDto> {
    return this.account.emailPreferences(userId);
  }

  @Put('email-preferences')
  saveEmailPreferences(
    @CurrentUser('sub') userId: string,
    @Body() dto: EmailPreferencesBody,
  ): Promise<EmailPreferencesDto> {
    return this.account.saveEmailPreferences(userId, dto);
  }

  @Post('delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser('sub') userId: string,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.account.deleteAccount(userId, dto);
    clearAuthCookies(res);
  }
}
