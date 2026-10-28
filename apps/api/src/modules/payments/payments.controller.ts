import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { JwtPayload, PaymentSessionDto, PaymentStatusDto } from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { StartPaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

type PaymentRequest = RawBodyRequest<Request> & { user?: JwtPayload };

/** Public: guests pay too. Fixed paths are declared before `:paymentId`. */
@ApiTags('Payments')
@Public()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Gateway → us (server to server). The adapter verifies the signature. */
  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  webhook(
    @Param('provider') provider: string,
    @Req() req: PaymentRequest,
  ): Promise<{ received: true; duplicate?: boolean }> {
    return this.payments.handleWebhook(provider, req.headers, req.rawBody);
  }

  /** "Pay now" on an unpaid order (signed-in owner, or a guest with the checkout email). */
  @Post('orders/:orderNumber/pay')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  payOrder(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: StartPaymentDto,
    @Req() req: PaymentRequest,
  ): Promise<PaymentSessionDto> {
    return this.payments.payOrder(orderNumber, { userId: req.user?.sub, email: dto.email });
  }

  @Get(':paymentId/status')
  status(@Param('paymentId') paymentId: string): Promise<PaymentStatusDto> {
    return this.payments.status(paymentId);
  }

  @Post(':paymentId/retry')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  retry(@Param('paymentId') paymentId: string): Promise<PaymentSessionDto> {
    return this.payments.retry(paymentId);
  }
}
