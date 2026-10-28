import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { MockCheckoutDto, MockPaymentCompleteResult } from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { MockCompleteDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

/** Plays the gateway's hosted page in development (404 when the mock provider is not active). */
@ApiTags('Payments (mock gateway)')
@Public()
@Controller('payments/mock')
export class MockGatewayController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':paymentId')
  checkout(@Param('paymentId') paymentId: string): Promise<MockCheckoutDto> {
    return this.payments.mockCheckout(paymentId);
  }

  @Post(':paymentId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @Param('paymentId') paymentId: string,
    @Body() dto: MockCompleteDto,
  ): Promise<MockPaymentCompleteResult> {
    return this.payments.mockComplete(paymentId, dto.outcome);
  }
}
