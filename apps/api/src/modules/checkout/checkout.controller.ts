import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { CheckoutQuoteDto, JwtPayload, PlaceOrderResultDto } from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { CART_COOKIE, cartSessionId } from '../cart/cart.controller';
import type { CartContext } from '../cart/cart.service';
import { CheckoutService } from './checkout.service';
import { PlaceOrderDto, QuoteRequestDto } from './dto/checkout.dto';

type CheckoutRequest = Request & { user?: JwtPayload };

/** Public: guests check out with their cart cookie; signed-in customers with their account. */
@ApiTags('Checkout')
@Public()
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  quote(@Req() req: CheckoutRequest, @Body() dto: QuoteRequestDto): Promise<CheckoutQuoteDto> {
    return this.checkout.quote(this.context(req), dto);
  }

  @Post('place')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async place(
    @Req() req: CheckoutRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: PlaceOrderDto,
  ): Promise<PlaceOrderResultDto> {
    const ctx = this.context(req);
    const result = await this.checkout.place(ctx, dto);
    if (ctx.userId && ctx.sessionId) res.clearCookie(CART_COOKIE, { path: '/' });
    return result;
  }

  private context(req: CheckoutRequest): CartContext {
    return {
      userId: req.user?.sub,
      sessionId: cartSessionId(req),
    };
  }
}
