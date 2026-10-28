import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { JwtPayload, SupportConversation, SupportMessage } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SupportChatDto, SupportFeedbackDto } from './dto/support-assistant.dto';
import { SupportAssistantService, type SupportCaller } from './support-assistant.service';

/** Customer support chat. Guests are identified by X-Visitor-Id, signed-in customers by their account. */
@ApiTags('support')
@Public()
@Controller('support/assistant')
export class SupportAssistantController {
  constructor(private readonly assistant: SupportAssistantService) {}

  private caller(
    user: JwtPayload | undefined,
    visitorId: string | undefined,
    req: Request,
  ): SupportCaller {
    return { user, visitorId, ip: req.ip };
  }

  /** Streams the answer as Server-Sent Events. */
  @Post('chat')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async chat(
    @Body() dto: SupportChatDto,
    @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-visitor-id') visitorId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.assistant.streamChat(this.caller(user, visitorId, req), dto, res);
  }

  @Get('conversations')
  conversations(
    @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-visitor-id') visitorId: string | undefined,
    @Req() req: Request,
  ): Promise<SupportConversation[]> {
    return this.assistant.conversations(this.caller(user, visitorId, req));
  }

  @Get('conversations/:id/messages')
  messages(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-visitor-id') visitorId: string | undefined,
    @Req() req: Request,
  ): Promise<SupportMessage[]> {
    return this.assistant.messages(this.caller(user, visitorId, req), id);
  }

  @Delete('conversations/:id')
  @HttpCode(204)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-visitor-id') visitorId: string | undefined,
    @Req() req: Request,
  ): Promise<void> {
    return this.assistant.deleteConversation(this.caller(user, visitorId, req), id);
  }

  @Post('messages/:messageId/feedback')
  @HttpCode(204)
  feedback(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() dto: SupportFeedbackDto,
    @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-visitor-id') visitorId: string | undefined,
    @Req() req: Request,
  ): Promise<void> {
    return this.assistant.feedback(this.caller(user, visitorId, req), messageId, dto.value ?? null);
  }
}
