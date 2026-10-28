import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import {
  BLOCKING_CART_PROBLEMS,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  fromCents,
  toCents,
  type CartDto,
  type CartItemDto,
  type CartProblem,
  type CartVendorGroup,
  type SavedItemDto,
} from '@ecommerce/types';
import { availableByVariant } from '../../common/utils/stock-availability';
import { PrismaService } from '../../prisma/prisma.service';
import type { AddToCartDto } from './dto/cart.dto';

/** Who owns the cart: a signed-in user, a guest session (cookie), or both (→ merge). */
export interface CartContext {
  userId?: string;
  sessionId?: string;
}

const variantForCart = {
  include: {
    product: {
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        deletedAt: true,
        currency: true,
        vendor: { select: { id: true, name: true, slug: true, status: true } },
        images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
      },
    },
  },
} satisfies Prisma.ProductVariantDefaultArgs;

const cartInclude = {
  items: { orderBy: { createdAt: 'asc' }, include: { variant: variantForCart } },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type CartVariant = Prisma.ProductVariantGetPayload<typeof variantForCart>;

const isPurchasable = (v: CartVariant) =>
  v.isActive &&
  v.product.status === 'PUBLISHED' &&
  v.product.deletedAt === null &&
  v.product.vendor.status === 'APPROVED';

/**
 * Cart rules: one line per variant; 1..99 per line; max 50 lines; never more than available stock.
 * Every read re-checks availability and price; price changes are flagged once and the stored price updated.
 * A guest cart is merged into the user's cart as soon as both are known.
 */
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(ctx: CartContext): Promise<CartDto> {
    const cart = await this.resolve(ctx);
    return cart ? this.toDto(cart) : this.emptyCart();
  }

  async addItem(ctx: CartContext, dto: AddToCartDto): Promise<CartDto> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      ...variantForCart,
    });
    if (!variant || !isPurchasable(variant))
      throw new NotFoundException('This product is not available');

    const available = (await availableByVariant(this.prisma, [variant.id])).get(variant.id) ?? 0;
    if (available <= 0) throw new BadRequestException('This item is out of stock');

    const cart = await this.resolve(ctx, { create: true, currency: variant.product.currency });
    if (!cart) throw new BadRequestException('Cart session missing');

    const existing = cart.items.find((i) => i.variantId === variant.id);
    const quantity = (existing?.quantity ?? 0) + dto.quantity;
    if (quantity > MAX_LINE_QUANTITY)
      throw new BadRequestException(`You can buy at most ${MAX_LINE_QUANTITY} of one item`);
    if (quantity > available) {
      throw new BadRequestException(
        `Only ${available} left in stock${existing ? ` (you already have ${existing.quantity} in your cart)` : ''}`,
      );
    }
    if (!existing && cart.items.length >= MAX_CART_LINES) {
      throw new BadRequestException(`Your cart can hold up to ${MAX_CART_LINES} different items`);
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity, unitPrice: variant.price },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, variantId: variant.id, quantity, unitPrice: variant.price },
      });
    }
    return this.reload(cart.id);
  }

  async updateItem(ctx: CartContext, itemId: string, quantity: number): Promise<CartDto> {
    const { cart, item } = await this.ownItem(ctx, itemId);
    if (quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
      return this.reload(cart.id);
    }
    const available =
      (await availableByVariant(this.prisma, [item.variantId])).get(item.variantId) ?? 0;
    if (quantity > available) throw new BadRequestException(`Only ${available} left in stock`);
    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.reload(cart.id);
  }

  async removeItem(ctx: CartContext, itemId: string): Promise<CartDto> {
    const { cart, item } = await this.ownItem(ctx, itemId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.reload(cart.id);
  }

  // ---------------------------------------------------------------- save for later (signed-in)

  async saveForLater(ctx: CartContext & { userId: string }, itemId: string): Promise<CartDto> {
    const { cart, item } = await this.ownItem(ctx, itemId);
    await this.prisma.$transaction([
      this.prisma.savedItem.upsert({
        where: { userId_variantId: { userId: ctx.userId, variantId: item.variantId } },
        update: {},
        create: { userId: ctx.userId, variantId: item.variantId },
      }),
      this.prisma.cartItem.delete({ where: { id: item.id } }),
    ]);
    return this.reload(cart.id);
  }

  async listSaved(userId: string): Promise<SavedItemDto[]> {
    const saved = await this.prisma.savedItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { variant: variantForCart },
    });
    const visible = saved.filter((s) => isPurchasable(s.variant));
    const stock = await availableByVariant(
      this.prisma,
      visible.map((s) => s.variantId),
    );
    return visible.map((s) => ({
      id: s.id,
      variantId: s.variantId,
      productName: s.variant.product.name,
      productSlug: s.variant.product.slug,
      variantName: s.variant.name,
      imageUrl: s.variant.product.images[0]?.url ?? null,
      price: Number(s.variant.price),
      currency: s.variant.product.currency,
      available: stock.get(s.variantId) ?? 0,
    }));
  }

  async moveToCart(ctx: CartContext & { userId: string }, savedId: string): Promise<CartDto> {
    const saved = await this.prisma.savedItem.findFirst({
      where: { id: savedId, userId: ctx.userId },
    });
    if (!saved) throw new NotFoundException('Saved item not found');
    const cart = await this.addItem(ctx, { variantId: saved.variantId, quantity: 1 });
    await this.prisma.savedItem.delete({ where: { id: saved.id } });
    return cart;
  }

  async removeSaved(userId: string, savedId: string): Promise<void> {
    const { count } = await this.prisma.savedItem.deleteMany({ where: { id: savedId, userId } });
    if (count === 0) throw new NotFoundException('Saved item not found');
  }

  // ---------------------------------------------------------------- internals

  /** Finds (optionally creates) the cart for this context; merges a guest cart into the user's cart. */
  private async resolve(
    ctx: CartContext,
    opts: { create?: boolean; currency?: string } = {},
  ): Promise<CartWithItems | null> {
    if (ctx.userId) {
      if (ctx.sessionId) await this.mergeGuestCart(ctx.userId, ctx.sessionId);
      const found = await this.prisma.cart.findUnique({
        where: { userId: ctx.userId },
        include: cartInclude,
      });
      if (found || !opts.create) return found;
      return this.prisma.cart.create({
        data: { userId: ctx.userId, currency: opts.currency ?? 'USD' },
        include: cartInclude,
      });
    }
    if (ctx.sessionId) {
      const found = await this.prisma.cart.findUnique({
        where: { sessionId: ctx.sessionId },
        include: cartInclude,
      });
      if (found || !opts.create) return found;
      return this.prisma.cart.create({
        data: { sessionId: ctx.sessionId, currency: opts.currency ?? 'USD' },
        include: cartInclude,
      });
    }
    return null;
  }

  /** Moves guest lines into the user's cart (quantities added, capped by stock), then deletes the guest cart. */
  private async mergeGuestCart(userId: string, sessionId: string): Promise<void> {
    const guest = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });
    if (!guest || guest.userId) return;

    const userCart = await this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId, currency: guest.currency },
      include: { items: true },
    });
    const stock = await availableByVariant(
      this.prisma,
      guest.items.map((i) => i.variantId),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const item of guest.items) {
        const existing = userCart.items.find((i) => i.variantId === item.variantId);
        const cap = Math.max(1, Math.min(MAX_LINE_QUANTITY, stock.get(item.variantId) ?? 0));
        const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, cap);
        if (existing) {
          await tx.cartItem.update({ where: { id: existing.id }, data: { quantity } });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              variantId: item.variantId,
              quantity,
              unitPrice: item.unitPrice,
            },
          });
        }
      }
      await tx.cart.delete({ where: { id: guest.id } });
    });
  }

  private async ownItem(ctx: CartContext, itemId: string) {
    const cart = await this.resolve(ctx);
    const item = cart?.items.find((i) => i.id === itemId);
    if (!cart || !item) throw new NotFoundException('Cart item not found');
    return { cart, item };
  }

  private async reload(cartId: string): Promise<CartDto> {
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: cartInclude,
    });
    return this.toDto(cart);
  }

  private emptyCart(): CartDto {
    return { id: null, currency: 'USD', itemCount: 0, subtotal: 0, groups: [], canCheckout: false };
  }

  private async toDto(cart: CartWithItems): Promise<CartDto> {
    const stock = await availableByVariant(
      this.prisma,
      cart.items.map((i) => i.variantId),
    );
    const priceUpdates: Promise<unknown>[] = [];

    const items: CartItemDto[] = cart.items.map((item) => {
      const v = item.variant;
      const available = stock.get(v.id) ?? 0;
      const unitPrice = Number(v.price);
      const storedPrice = Number(item.unitPrice);
      const problems: CartProblem[] = [];

      if (!isPurchasable(v)) problems.push('UNAVAILABLE');
      else if (available <= 0) problems.push('OUT_OF_STOCK');
      else if (item.quantity > available) problems.push('INSUFFICIENT_STOCK');

      let previousUnitPrice: number | null = null;
      if (toCents(storedPrice) !== toCents(unitPrice)) {
        problems.push('PRICE_CHANGED');
        previousUnitPrice = storedPrice;
        // Flag once: store the new price so the warning disappears on the next load.
        priceUpdates.push(
          this.prisma.cartItem.update({ where: { id: item.id }, data: { unitPrice: v.price } }),
        );
      }

      return {
        id: item.id,
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        productSlug: v.product.slug,
        variantName: v.name,
        sku: v.sku,
        imageUrl: v.product.images[0]?.url ?? null,
        vendorId: v.product.vendor.id,
        unitPrice,
        previousUnitPrice,
        quantity: item.quantity,
        available,
        lineTotal: fromCents(toCents(unitPrice) * item.quantity),
        problems,
      };
    });
    await Promise.all(priceUpdates);

    const blocking = (i: CartItemDto) => i.problems.some((p) => BLOCKING_CART_PROBLEMS.includes(p));
    const groups = new Map<string, CartVendorGroup>();
    for (const [index, item] of items.entries()) {
      const vendor = cart.items[index].variant.product.vendor;
      const group = groups.get(vendor.id) ?? {
        vendor: { id: vendor.id, name: vendor.name, slug: vendor.slug },
        items: [],
        subtotal: 0,
      };
      group.items.push(item);
      if (!blocking(item))
        group.subtotal = fromCents(toCents(group.subtotal) + toCents(item.lineTotal));
      groups.set(vendor.id, group);
    }

    const subtotalCents = items
      .filter((i) => !blocking(i))
      .reduce((sum, i) => sum + toCents(i.lineTotal), 0);
    return {
      id: cart.id,
      currency: cart.items[0]?.variant.product.currency ?? cart.currency,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: fromCents(subtotalCents),
      groups: [...groups.values()],
      canCheckout: items.length > 0 && !items.some(blocking),
    };
  }
}
