import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { CartDto, JwtPayload, WishlistDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { StockAlertDto, WishlistAddDto } from './dto/wishlist.dto';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist')
@ApiBearerAuth()
@Controller()
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get('wishlist')
  get(@CurrentUser('sub') userId: string): Promise<WishlistDto> {
    return this.wishlist.get(userId);
  }

  @Post('wishlist/items')
  @HttpCode(HttpStatus.OK)
  add(@CurrentUser('sub') userId: string, @Body() dto: WishlistAddDto): Promise<WishlistDto> {
    return this.wishlist.add(userId, dto);
  }

  @Delete('wishlist/items/:id')
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<WishlistDto> {
    return this.wishlist.remove(userId, id);
  }

  @Delete('wishlist/products/:productId')
  removeProduct(
    @CurrentUser('sub') userId: string,
    @Param('productId') productId: string,
  ): Promise<WishlistDto> {
    return this.wishlist.removeProduct(userId, productId);
  }

  @Post('wishlist/items/:id/move-to-cart')
  @HttpCode(HttpStatus.OK)
  moveToCart(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<{ wishlist: WishlistDto; cart: CartDto }> {
    return this.wishlist.moveToCart(userId, id);
  }

  /** Public: guests subscribe with an email. */
  @Public()
  @Post('stock-alerts')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  notifyMe(
    @Req() req: Request & { user?: JwtPayload },
    @Body() dto: StockAlertDto,
  ): Promise<{ subscribed: true }> {
    return this.wishlist.subscribeStockAlert(req.user?.sub, dto);
  }
}
