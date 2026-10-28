import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ManualOrderResult } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CartService } from '../cart/cart.service';
import { CheckoutService } from './checkout.service';
import type { ManualOrderDto } from './dto/manual-order.dto';

/**
 * Staff places an order for a customer (phone / WhatsApp orders). It goes through a temporary cart and the normal
 * checkout, so prices, stock, shipping, tax, COD limits and emails are exactly as for a storefront order.
 * Cash on delivery; linked to the customer's account when the email matches.
 */
@Injectable()
export class ManualOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly checkout: CheckoutService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: ManualOrderDto, actorId: string): Promise<ManualOrderResult> {
    const ctx = { sessionId: `manual-${randomUUID()}` };
    try {
      for (const item of dto.items) {
        try {
          await this.cart.addItem(ctx, { variantId: item.variantId, quantity: item.quantity });
        } catch (error) {
          throw new BadRequestException(`Item ${item.variantId}: ${(error as Error).message}`);
        }
      }
      const { order } = await this.checkout.place(
        ctx,
        {
          email: dto.email,
          address: dto.address,
          paymentMethod: 'COD',
          customerNote: dto.customerNote ?? undefined,
          idempotencyKey: randomUUID(),
        } as Parameters<CheckoutService['place']>[1],
        { staff: true },
      );
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (user)
        await this.prisma.order.update({ where: { id: order.id }, data: { userId: user.id } });
      await this.prisma.orderNote.create({
        data: {
          orderId: order.id,
          authorId: actorId,
          isCustomerVisible: false,
          content: ['Manual order placed by staff.', dto.staffNote?.trim()]
            .filter(Boolean)
            .join('\n'),
        },
      });
      await this.audit.log({
        actorId,
        action: 'order.manual.create',
        entityType: 'Order',
        entityId: order.id,
        after: { orderNumber: order.orderNumber, email: dto.email },
      });
      return { orderId: order.id, orderNumber: order.orderNumber, linkedToAccount: Boolean(user) };
    } finally {
      await this.prisma.cart.deleteMany({ where: { sessionId: ctx.sessionId } });
    }
  }
}
