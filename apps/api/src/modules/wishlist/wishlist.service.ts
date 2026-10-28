import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@ecommerce/database';
import {
  EmailTemplateKey,
  type CartDto,
  type WishlistDto,
  type WishlistItemDto,
} from '@ecommerce/types';
import { formatMoney } from '../../common/utils/money';
import { availableByVariant } from '../../common/utils/stock-availability';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { StockAlertDto, WishlistAddDto } from './dto/wishlist.dto';
import { isPriceDrop } from './wishlist-rules';

const itemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      basePrice: true,
      compareAtPrice: true,
      vendor: { select: { name: true, status: true } },
      images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
      variants: {
        where: { isActive: true },
        orderBy: { price: 'asc' },
        select: { id: true, name: true, price: true, compareAtPrice: true },
      },
    },
  },
} satisfies Prisma.WishlistItemInclude;
type ItemRow = Prisma.WishlistItemGetPayload<{ include: typeof itemInclude }>;

/**
 * One default wishlist per customer. Saving remembers the price; a sweep (every 15 min, WishlistSweepService)
 * emails customers whose saved items got cheaper (WISHLIST_PRICE_DROP, marketing → respects opt-out) and
 * re-bases the saved price so each drop is announced once.
 */
@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async get(userId: string): Promise<WishlistDto> {
    const list = await this.prisma.wishlist.findFirst({
      where: { userId, isDefault: true },
      include: { items: { include: itemInclude, orderBy: { createdAt: 'desc' } } },
    });
    const items = list?.items ?? [];
    const currency = await this.storeCurrency();
    const stock = await availableByVariant(
      this.prisma,
      items.flatMap((i) => (i.variantId ? [i.variantId] : i.product.variants.map((v) => v.id))),
    );
    return {
      items: items.map((i) => this.toDto(i, stock, currency)),
      productIds: [...new Set(items.map((i) => i.productId))],
    };
  }

  async add(userId: string, dto: WishlistAddDto): Promise<WishlistDto> {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, status: 'PUBLISHED' },
      include: { variants: { where: { isActive: true }, select: { id: true, price: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    const variant = dto.variantId ? product.variants.find((v) => v.id === dto.variantId) : null;
    if (dto.variantId && !variant) throw new BadRequestException('This option is not available');
    const listId = await this.listId(userId);
    const existing = await this.prisma.wishlistItem.findFirst({
      where: { wishlistId: listId, productId: product.id, variantId: variant?.id ?? null },
    });
    if (!existing) {
      await this.prisma.wishlistItem.create({
        data: {
          wishlistId: listId,
          productId: product.id,
          variantId: variant?.id ?? null,
          priceAtAdd: variant ? variant.price : product.basePrice,
        },
      });
    }
    return this.get(userId);
  }

  async remove(userId: string, itemId: string): Promise<WishlistDto> {
    const { count } = await this.prisma.wishlistItem.deleteMany({
      where: { id: itemId, wishlist: { userId } },
    });
    if (count === 0) throw new NotFoundException('Item not found');
    return this.get(userId);
  }

  async removeProduct(userId: string, productId: string): Promise<WishlistDto> {
    await this.prisma.wishlistItem.deleteMany({ where: { productId, wishlist: { userId } } });
    return this.get(userId);
  }

  async moveToCart(
    userId: string,
    itemId: string,
  ): Promise<{ wishlist: WishlistDto; cart: CartDto }> {
    const item = await this.prisma.wishlistItem.findFirst({
      where: { id: itemId, wishlist: { userId } },
      include: itemInclude,
    });
    if (!item) throw new NotFoundException('Item not found');
    const variantId = item.variantId ?? item.product.variants[0]?.id;
    if (!variantId) throw new BadRequestException('This product is no longer available');
    const cart = await this.cart.addItem({ userId }, { variantId, quantity: 1 });
    await this.prisma.wishlistItem.delete({ where: { id: item.id } });
    return { wishlist: await this.get(userId), cart };
  }

  /** "Notify me": signed-in customers use their account email; guests give one. Re-arms a used alert. */
  async subscribeStockAlert(
    userId: string | undefined,
    dto: StockAlertDto,
  ): Promise<{ subscribed: true }> {
    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
      : null;
    const email = user?.email ?? dto.email;
    if (!email) throw new BadRequestException('Enter your email to be notified');
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variantId, isActive: true, product: { status: 'PUBLISHED' } },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Product not found');
    await this.prisma.stockAlert.upsert({
      where: { variantId_email: { variantId: variant.id, email } },
      update: { notifiedAt: null, userId: userId ?? undefined },
      create: { variantId: variant.id, email, userId: userId ?? null },
    });
    return { subscribed: true };
  }

  /** Emails one message per customer listing saved items that got cheaper. Returns emails sent. */
  async sweepPriceDrops(): Promise<number> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { priceAtAdd: { not: null }, product: { status: 'PUBLISHED' } },
      include: {
        ...itemInclude,
        wishlist: { select: { userId: true, user: { select: { email: true, firstName: true } } } },
      },
      take: 2000,
    });
    const byUser = new Map<
      string,
      {
        email: string;
        firstName: string;
        lines: string[];
        ids: { id: string; price: number }[];
        slug: string;
      }
    >();
    const currency = await this.storeCurrency();
    for (const i of items) {
      const price = this.currentPrice(i);
      if (price === null || !isPriceDrop(Number(i.priceAtAdd), price)) continue;
      const u = i.wishlist.user;
      const entry = byUser.get(i.wishlist.userId) ?? {
        email: u.email,
        firstName: u.firstName,
        lines: [],
        ids: [],
        slug: i.product.slug,
      };
      entry.lines.push(
        `${i.product.name}: ${formatMoney(Number(i.priceAtAdd), currency)} → ${formatMoney(price, currency)}`,
      );
      entry.ids.push({ id: i.id, price });
      byUser.set(i.wishlist.userId, entry);
    }
    const site = this.config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    let sent = 0;
    for (const [userId, e] of byUser) {
      try {
        await this.notifications.sendEmail({
          template: EmailTemplateKey.WISHLIST_PRICE_DROP,
          to: e.email,
          userId,
          data: {
            heading: 'Price drop on your wishlist',
            body: [
              `Hi ${e.firstName}, good news — items you saved are cheaper now:`,
              ...e.lines,
            ].join('\n'),
            ctaLabel: 'View wishlist',
            ctaUrl: `${site}/account/wishlist`,
          },
        });
        sent++;
      } catch (error) {
        this.logger.error(`Price-drop email failed for ${userId}: ${String(error)}`);
      }
      // Re-base so the same drop is not announced again.
      for (const { id, price } of e.ids) {
        await this.prisma.wishlistItem.update({ where: { id }, data: { priceAtAdd: price } });
      }
    }
    return sent;
  }

  // ---------------------------------------------------------------- helpers

  private async listId(userId: string): Promise<string> {
    const list =
      (await this.prisma.wishlist.findFirst({ where: { userId, isDefault: true } })) ??
      (await this.prisma.wishlist.create({ data: { userId } }));
    return list.id;
  }

  private currentPrice(i: ItemRow): number | null {
    if (i.variantId) {
      const v = i.product.variants.find((x) => x.id === i.variantId);
      return v ? Number(v.price) : null;
    }
    return i.product.variants[0]
      ? Number(i.product.variants[0].price)
      : Number(i.product.basePrice);
  }

  private async storeCurrency(): Promise<string> {
    const c = await this.prisma.currency.findFirst({
      where: { isDefault: true },
      select: { code: true },
    });
    return c?.code ?? 'USD';
  }

  private toDto(i: ItemRow, stock: Map<string, number>, currency: string): WishlistItemDto {
    const variant = i.variantId
      ? i.product.variants.find((v) => v.id === i.variantId)
      : i.product.variants[0];
    const price = this.currentPrice(i) ?? Number(i.product.basePrice);
    const unavailable =
      i.product.status !== 'PUBLISHED' ||
      i.product.vendor.status !== 'APPROVED' ||
      (i.variantId !== null && !variant);
    const ids = i.variantId ? [i.variantId] : i.product.variants.map((v) => v.id);
    const priceAtAdd = i.priceAtAdd === null ? null : Number(i.priceAtAdd);
    return {
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      name: i.product.name,
      slug: i.product.slug,
      variantName: i.variantId ? (variant?.name ?? null) : null,
      vendorName: i.product.vendor.name,
      imageUrl: i.product.images[0]?.url ?? null,
      currency,
      price,
      compareAtPrice: variant?.compareAtPrice
        ? Number(variant.compareAtPrice)
        : i.product.compareAtPrice
          ? Number(i.product.compareAtPrice)
          : null,
      priceAtAdd,
      priceDropped: priceAtAdd !== null && price < priceAtAdd,
      inStock: !unavailable && ids.some((id) => (stock.get(id) ?? 0) > 0),
      unavailable,
      addedAt: i.createdAt.toISOString(),
    };
  }
}
