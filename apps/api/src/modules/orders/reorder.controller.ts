import { Controller, HttpCode, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ReorderResult } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';

/** Buy again: puts the order's items back in the cart (what is still sold and in stock). */
@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class ReorderController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
  ) {}

  @Post(':orderNumber/reorder')
  @HttpCode(HttpStatus.OK)
  async reorder(
    @CurrentUser('sub') userId: string,
    @Param('orderNumber') orderNumber: string,
  ): Promise<ReorderResult> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      select: {
        items: {
          select: { variantId: true, quantity: true, productName: true, variantName: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const result: ReorderResult = { added: 0, skipped: [] };
    for (const i of order.items) {
      const name = `${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`;
      if (!i.variantId) {
        result.skipped.push({ name, reason: 'No longer sold' });
        continue;
      }
      try {
        await this.cart.addItem({ userId }, { variantId: i.variantId, quantity: i.quantity });
        result.added++;
      } catch (error) {
        result.skipped.push({ name, reason: (error as Error).message });
      }
    }
    return result;
  }
}
