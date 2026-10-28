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
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { CartDto, JwtPayload, SavedItemDto } from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { CartService, type CartContext } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

export const CART_COOKIE = 'cart_session';
export const CART_HEADER = 'x-cart-session';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guest cart id: the app sends it as a header (no cookies in Flutter web / cross-site); the web uses the cookie. */
export function cartSessionId(req: Request): string | undefined {
  const header = req.headers[CART_HEADER];
  if (typeof header === 'string' && UUID_RE.test(header)) return header.toLowerCase();
  return (req.cookies as Record<string, string> | undefined)?.[CART_COOKIE];
}

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  domain: process.env.COOKIE_DOMAIN || undefined,
  maxAge: 30 * 24 * 60 * 60 * 1000,
});

type CartRequest = Request & { user?: JwtPayload };

/**
 * Public: guests are identified by the HttpOnly `cart_session` cookie, signed-in users by their JWT.
 * When both are present the guest cart is merged into the user's cart and the cookie is cleared.
 */
@ApiTags('Cart')
@Public()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@Req() req: CartRequest, @Res({ passthrough: true }) res: Response): Promise<CartDto> {
    return this.run(req, res, (ctx) => this.cart.getCart(ctx));
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  add(
    @Req() req: CartRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddToCartDto,
  ): Promise<CartDto> {
    return this.run(req, res, (ctx) => this.cart.addItem(ctx, dto), { createSession: true });
  }

  @Patch('items/:id')
  update(
    @Req() req: CartRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartDto> {
    return this.run(req, res, (ctx) => this.cart.updateItem(ctx, id, dto.quantity));
  }

  @Delete('items/:id')
  remove(
    @Req() req: CartRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<CartDto> {
    return this.run(req, res, (ctx) => this.cart.removeItem(ctx, id));
  }

  @Post('items/:id/save-for-later')
  @HttpCode(HttpStatus.OK)
  saveForLater(
    @Req() req: CartRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<CartDto> {
    return this.run(req, res, (ctx) => this.cart.saveForLater(this.signedIn(ctx), id));
  }

  @Get('saved')
  saved(@Req() req: CartRequest): Promise<SavedItemDto[]> {
    return this.cart.listSaved(this.signedIn(this.context(req)).userId);
  }

  @Post('saved/:id/move-to-cart')
  @HttpCode(HttpStatus.OK)
  moveToCart(
    @Req() req: CartRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<CartDto> {
    return this.run(req, res, (ctx) => this.cart.moveToCart(this.signedIn(ctx), id));
  }

  @Delete('saved/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSaved(@Req() req: CartRequest, @Param('id') id: string): Promise<void> {
    return this.cart.removeSaved(this.signedIn(this.context(req)).userId, id);
  }

  // ---------------------------------------------------------------- helpers

  private context(req: CartRequest): CartContext {
    return {
      userId: req.user?.sub,
      sessionId: cartSessionId(req),
    };
  }

  private signedIn(ctx: CartContext): CartContext & { userId: string } {
    if (!ctx.userId) throw new UnauthorizedException('Sign in to use saved items');
    return ctx as CartContext & { userId: string };
  }

  private async run(
    req: CartRequest,
    res: Response,
    action: (ctx: CartContext) => Promise<CartDto>,
    opts: { createSession?: boolean } = {},
  ): Promise<CartDto> {
    const ctx = this.context(req);
    if (!ctx.userId && !ctx.sessionId && opts.createSession) {
      ctx.sessionId = randomUUID();
      res.cookie(CART_COOKIE, ctx.sessionId, cookieOptions());
    }
    const result = await action(ctx);
    // Guest cart has been merged into the user's cart.
    if (ctx.userId && ctx.sessionId)
      res.clearCookie(CART_COOKIE, { ...cookieOptions(), maxAge: undefined });
    return result;
  }
}
