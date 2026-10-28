import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@ecommerce/database';
import {
  PAYMENT_METHOD_DESCRIPTIONS,
  PAYMENT_METHOD_LABELS,
  fromCents,
  isOnlinePayment,
  toCents,
  type CheckoutGroup,
  type CheckoutQuoteDto,
  type CheckoutQuoteInput,
  type ShippingDestination,
  type PaymentMethod,
  type PaymentOptionDto,
  type PaymentSessionDto,
  type PlaceOrderResultDto,
  type ShippingAddress,
} from '@ecommerce/types';
import { formatMoney } from '../../common/utils/money';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CartService, type CartContext } from '../cart/cart.service';
import { NotificationsService } from '../notifications/notifications.service';
import { sendOrderPlacedEmails } from '../orders/order-emails';
import { orderInclude, toOrderDto, type OrderFull } from '../orders/order.mapper';
import { commissionForLines, generateOrderNumber } from '../orders/order-rules';
import { loadCommissionResolver, type CommissionResolver } from '../vendors/commission-resolver';
import { reserveStock } from '../orders/order-stock';
import { PaymentsService } from '../payments/payments.service';
import { PromotionsService } from '../promotions/promotions.service';
import { allocate } from '../promotions/discount-engine';
import { GiftCardsService } from '../loyalty/gift-cards.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { lineTaxCents, pickRate } from '../localization/tax-rules';
import { TaxesService } from '../localization/taxes.service';
import { shippingMethodLabel } from '../shipping/shipping-rules';
import { ShippingService } from '../shipping/shipping.service';
import type { PlaceOrderDto } from './dto/checkout.dto';

/**
 * Checkout: quote (totals) and place order.
 * One Order → one VendorOrder per vendor → OrderItems (price snapshots). Stock is reserved in the same
 * transaction; the cart is emptied; confirmation emails go to the customer and each vendor.
 * Online methods start as PENDING_PAYMENT with a short stock hold; PaymentsService confirms them via the gateway webhook.
 * TODO: coupons/gift cards/loyalty (Promotions step), tax rates (Settings).
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly payments: PaymentsService,
    private readonly shipping: ShippingService,
    private readonly promotions: PromotionsService,
    private readonly loyalty: LoyaltyService,
    private readonly giftCards: GiftCardsService,
    private readonly taxes: TaxesService,
  ) {}

  async quote(ctx: CartContext, input: CheckoutQuoteInput = {}): Promise<CheckoutQuoteDto> {
    const requested = input.paymentMethod;
    const cart = await this.cart.getCart(ctx);
    const [codEnabled, codFeeSetting, codMax, online] = await Promise.all([
      readSetting(this.prisma, 'payments.codEnabled', true),
      readSetting(this.prisma, 'checkout.codFee', 0),
      readSetting(this.prisma, 'checkout.codMaxOrderTotal', 5000),
      this.payments.onlineMethods(),
    ]);

    // Shipping: one parcel per seller, priced by the zone of the destination.
    const destination = await this.destinationFor(ctx, input);
    const weights = await this.parcelWeights(cart.groups.flatMap((g) => g.items));
    const shipping = await this.shipping.quote(
      destination,
      cart.groups.map((g) => ({
        vendorId: g.vendor.id,
        subtotal: g.subtotal,
        weightGrams: g.items.reduce((n, i) => n + (weights.get(i.variantId) ?? 0) * i.quantity, 0),
      })),
      input.shippingRateIds ?? {},
    );
    const undeliverable: string[] = [];
    const groups: CheckoutGroup[] = cart.groups.map((g) => {
      const parcel = shipping.parcels.get(g.vendor.id)!;
      const pick = parcel.selected;
      if (!pick) undeliverable.push(g.vendor.name);
      return {
        vendor: g.vendor,
        items: g.items,
        subtotal: g.subtotal,
        shipping: pick?.price ?? 0,
        shippingOptions: parcel.options,
        shippingRateId: pick?.rateId ?? null,
        shippingMethod: pick ? shippingMethodLabel(pick) : 'Not available',
        estimatedDays: pick?.estimatedDays ?? null,
        weightGrams: g.items.reduce((n, i) => n + (weights.get(i.variantId) ?? 0) * i.quantity, 0),
        discount: 0,
        sellerFundedDiscount: 0,
        tenders: 0,
        tax: 0,
        taxAdded: 0,
        taxLines: [],
      };
    });
    const subtotal = cart.subtotal;
    const shippingTotal = fromCents(groups.reduce((sum, g) => sum + toCents(g.shipping), 0));
    // Discounts: automatic promotions + coupon (engine works in cents, per seller).
    const products = await this.productInfo(
      cart.groups.flatMap((g) => g.items.map((i) => i.productId)),
    );
    const deals = await this.promotions.evaluate({
      lines: cart.groups.flatMap((g) =>
        g.items.map((i) => ({
          key: i.id,
          vendorId: g.vendor.id,
          productId: i.productId,
          categoryId: products.get(i.productId)?.categoryId ?? null,
          unitCents: toCents(i.unitPrice),
          quantity: i.quantity,
        })),
      ),
      groups: groups.map((g) => ({ vendorId: g.vendor.id, shippingCents: toCents(g.shipping) })),
      couponCode: input.couponCode,
      customer: { userId: ctx.userId, email: input.email },
      money: (c) => formatMoney(fromCents(c), cart.currency),
    });
    for (const g of groups) {
      const d = deals.byVendor.get(g.vendor.id);
      g.discount = d ? fromCents(d.itemsCents + d.shippingCents) : 0;
      g.sellerFundedDiscount = d ? fromCents(d.vendorFundedCents) : 0;
    }
    const discountTotal = fromCents(deals.totalCents);
    // Tax per line on the price after item discounts (the seller's item discount is spread over their lines).
    // Inclusive rates: the tax is part of the price. Exclusive rates: added on top (part of the total).
    const taxCtx = await this.taxes.checkoutContext();
    const taxDest = destination?.countryCode ? destination : { countryCode: taxCtx.defaultCountry };
    for (const g of groups) {
      if (!taxCtx.enabled) break;
      const itemDiscount = allocate(
        deals.byVendor.get(g.vendor.id)?.itemsCents ?? 0,
        new Map(g.items.map((i) => [i.id, toCents(i.unitPrice) * i.quantity])),
      );
      let taxCents = 0;
      let addedCents = 0;
      for (const i of g.items) {
        const rate = pickRate(
          taxCtx.rates,
          products.get(i.productId)?.taxClass ?? 'standard',
          taxDest,
        );
        if (!rate) continue;
        const cents = lineTaxCents(
          toCents(i.unitPrice) * i.quantity - (itemDiscount.get(i.id) ?? 0),
          rate.rate,
          rate.isInclusive,
        );
        taxCents += cents;
        if (!rate.isInclusive) addedCents += cents;
        g.taxLines.push({
          itemId: i.id,
          name: rate.name,
          rate: Math.round(rate.rate * 10000) / 100,
          inclusive: rate.isInclusive,
          amount: fromCents(cents),
        });
      }
      g.tax = fromCents(taxCents);
      g.taxAdded = fromCents(addedCents);
    }
    const taxTotal = fromCents(groups.reduce((s, g) => s + toCents(g.tax), 0));
    const taxAdded = fromCents(groups.reduce((s, g) => s + toCents(g.taxAdded), 0));
    const afterDiscountCents =
      toCents(subtotal) + toCents(shippingTotal) - deals.totalCents + toCents(taxAdded);
    // Points, then the gift card, pay part (or all) of what is left. Store-funded; split across sellers so
    // refunds on cancellation / returns never exceed the money actually paid.
    const loyalty = ctx.userId
      ? await this.loyalty.checkoutPoints(
          ctx.userId,
          afterDiscountCents,
          Boolean(input.redeemPoints),
        )
      : null;
    const pointsCents = loyalty ? toCents(loyalty.amount) : 0;
    const giftCard = input.giftCardCode
      ? await this.giftCards.checkoutCard(
          input.giftCardCode,
          cart.currency,
          afterDiscountCents - pointsCents,
        )
      : null;
    const tenderCents = pointsCents + (giftCard?.applied ? toCents(giftCard.amount) : 0);
    const shares = allocate(
      tenderCents,
      new Map(
        groups.map((g) => [
          g.vendor.id,
          toCents(g.subtotal) + toCents(g.shipping) - toCents(g.discount) + toCents(g.taxAdded),
        ]),
      ),
    );
    for (const g of groups) g.tenders = fromCents(shares.get(g.vendor.id) ?? 0);
    const beforeFees = fromCents(afterDiscountCents - tenderCents);
    // COD fee = store fee + the selected delivery options' COD fees.
    const codFeeTotal = fromCents(toCents(codFeeSetting) + shipping.codFeeCents);
    const codTotal = fromCents(toCents(beforeFees) + toCents(codFeeTotal));
    const codWithinLimit = codMax <= 0 || codTotal <= codMax;

    const option = (
      method: PaymentMethod,
      fee: number,
      reason: string | null,
    ): PaymentOptionDto => ({
      method,
      label: PAYMENT_METHOD_LABELS[method],
      description: PAYMENT_METHOD_DESCRIPTIONS[method] ?? '',
      fee,
      available: reason === null,
      reason,
    });
    let paymentOptions: PaymentOptionDto[] = [
      ...online.map((m) => option(m, 0, null)),
      option(
        'COD',
        codFeeTotal,
        !shipping.codAvailable
          ? 'Not available with the chosen delivery option'
          : codWithinLimit
            ? null
            : `Available for orders up to ${formatMoney(codMax, cart.currency)}`,
      ),
    ];
    if (!codEnabled) paymentOptions = paymentOptions.filter((o) => o.method !== 'COD');
    // Nothing left to pay: no payment method needed.
    if (cart.itemCount > 0 && toCents(beforeFees) === 0)
      paymentOptions = [option('GIFT_CARD', 0, null)];
    const paymentMethods = paymentOptions.filter((o) => o.available).map((o) => o.method);
    const selected =
      requested && paymentMethods.includes(requested) ? requested : (paymentMethods[0] ?? null);
    const codFee = selected === 'COD' ? codFeeTotal : 0;
    const grandTotal = fromCents(toCents(beforeFees) + toCents(codFee));

    const problems: string[] = [];
    if (cart.itemCount === 0) problems.push('Your cart is empty');
    if (!cart.canCheckout && cart.itemCount > 0)
      problems.push('Some items are unavailable or low on stock. Update your cart.');
    if (undeliverable.length > 0)
      problems.push(
        `We cannot deliver ${undeliverable.join(', ')}'s items to this address. Try another address or remove them.`,
      );
    if (cart.itemCount > 0 && paymentMethods.length === 0)
      problems.push(
        codWithinLimit
          ? 'No payment method is available right now'
          : `Cash on delivery is available for orders up to ${formatMoney(codMax, cart.currency)}`,
      );

    return {
      currency: cart.currency,
      groups,
      subtotal,
      shippingTotal,
      discountTotal,
      taxTotal,
      taxAdded,
      taxIncluded: fromCents(toCents(taxTotal) - toCents(taxAdded)),
      codFee,
      grandTotal,
      paymentMethods,
      paymentOptions,
      selectedPaymentMethod: selected,
      canPlace: problems.length === 0,
      problems,
      freeShippingAbove: shipping.freeShippingAbove,
      shippingZone: shipping.zoneName,
      discounts: deals.lines.map((l) => ({
        source: l.source,
        label: l.label,
        amount: fromCents(l.amountCents),
      })),
      coupon:
        deals.couponCode && deals.coupon
          ? { code: deals.couponCode, applied: deals.coupon.applied, message: deals.coupon.message }
          : null,
      loyalty,
      giftCard,
    };
  }

  /** `staff`: a manual order placed by staff (allowed in maintenance mode and when guest checkout is off). */
  async place(
    ctx: CartContext,
    dto: PlaceOrderDto,
    opts: { staff?: boolean } = {},
  ): Promise<PlaceOrderResultDto> {
    if (!opts.staff && (await readSetting(this.prisma, 'store.maintenanceMode', false))) {
      throw new BadRequestException(
        'The store is in maintenance mode. Please try again a little later.',
      );
    }
    // Same idempotency key = same order (double click / retry after a network error).
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: orderInclude,
    });
    if (existing && (existing.userId === (ctx.userId ?? null) || existing.email === dto.email)) {
      const payment =
        existing.status === 'PENDING_PAYMENT'
          ? await this.payments.sessionForOrder(existing.id)
          : null;
      return { order: toOrderDto(existing), payment };
    }

    const user = ctx.userId
      ? await this.prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { id: true, email: true, firstName: true },
        })
      : null;
    if (!user) {
      const guestAllowed = await readSetting(this.prisma, 'checkout.guestCheckout', true);
      if (!guestAllowed && !opts.staff)
        throw new BadRequestException('Please sign in to check out');
      if (!dto.email) throw new BadRequestException('Email is required for guest checkout');
    }
    const email = user?.email ?? dto.email!;
    const address = await this.resolveAddress(user?.id, dto);

    const quote = await this.quote(ctx, {
      paymentMethod: dto.paymentMethod,
      destination: address,
      shippingRateIds: dto.shippingRateIds,
      couponCode: dto.couponCode,
      redeemPoints: dto.redeemPoints,
      giftCardCode: dto.giftCardCode,
      email,
    });
    if (dto.giftCardCode && !quote.giftCard?.applied)
      throw new BadRequestException(quote.giftCard?.message ?? 'This gift card cannot be used');
    if (dto.couponCode && !quote.coupon?.applied)
      throw new BadRequestException(quote.coupon?.message ?? 'This coupon cannot be used');
    if (!quote.canPlace) throw new BadRequestException(quote.problems.join(' '));
    if (!quote.paymentMethods.includes(dto.paymentMethod))
      throw new BadRequestException('This payment method is not available');

    const cartRow = await this.prisma.cart.findFirst({
      where: ctx.userId ? { userId: ctx.userId } : { sessionId: ctx.sessionId ?? '__none__' },
      include: {
        items: { include: { variant: { include: { product: { include: { vendor: true } } } } } },
      },
    });
    if (!cartRow || cartRow.items.length === 0) throw new BadRequestException('Your cart is empty');

    const defaultRate = await readSetting(this.prisma, 'marketplace.defaultCommissionRate', 10);
    const commissionRate = await loadCommissionResolver(this.prisma, defaultRate);
    const online = isOnlinePayment(dto.paymentMethod);
    const order = await this.createOrder({
      online,
      holdMinutes: online ? await this.payments.holdMinutes() : undefined,
      cartRow,
      quote,
      dto,
      email,
      userId: user?.id ?? null,
      address,
      commissionRate,
    });

    await this.audit.log({
      actorId: user?.id,
      action: 'order.place',
      entityType: 'Order',
      entityId: order.id,
      after: { orderNumber: order.orderNumber, grandTotal: quote.grandTotal },
    });

    // COD is confirmed now; online orders are confirmed (and emailed) when the gateway reports payment.
    let payment: PaymentSessionDto | null = null;
    if (online) {
      try {
        payment = await this.payments.sessionForOrder(order.id);
      } catch (error) {
        // The order exists and holds stock: the customer can retry from the order page.
        this.logger.error(`Could not open payment for ${order.orderNumber}: ${String(error)}`);
      }
    } else {
      await sendOrderPlacedEmails(
        {
          prisma: this.prisma,
          notifications: this.notifications,
          config: this.config,
          logger: this.logger,
        },
        order.id,
      );
    }
    return { order: toOrderDto(order), payment };
  }

  // ---------------------------------------------------------------- internals

  /** Saved address (signed-in) wins over a typed destination; none = default rate estimate. */
  private async destinationFor(
    ctx: CartContext,
    input: CheckoutQuoteInput,
  ): Promise<ShippingDestination | null> {
    if (input.addressId && ctx.userId) {
      const saved = await this.prisma.address.findFirst({
        where: { id: input.addressId, userId: ctx.userId },
        select: { countryCode: true, state: true, city: true },
      });
      if (saved) return saved;
    }
    return input.destination?.countryCode ? input.destination : null;
  }

  /** Product → category (category-scoped discounts) and tax class. */
  private async productInfo(
    productIds: string[],
  ): Promise<Map<string, { categoryId: string; taxClass: string }>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(productIds)] } },
      select: { id: true, categoryId: true, taxClass: true },
    });
    return new Map(
      rows.map((r) => [r.id, { categoryId: r.categoryId, taxClass: r.taxClass ?? 'standard' }]),
    );
  }

  /** Grams per variant (variant weight, else product weight, else 0). */
  private async parcelWeights(items: { variantId: string }[]): Promise<Map<string, number>> {
    if (items.length === 0) return new Map();
    const rows = await this.prisma.productVariant.findMany({
      where: { id: { in: items.map((i) => i.variantId) } },
      select: { id: true, weightGrams: true, product: { select: { weightGrams: true } } },
    });
    return new Map(rows.map((r) => [r.id, r.weightGrams ?? r.product.weightGrams ?? 0]));
  }

  private async resolveAddress(
    userId: string | undefined,
    dto: PlaceOrderDto,
  ): Promise<ShippingAddress> {
    if (dto.addressId) {
      if (!userId) throw new BadRequestException('Sign in to use a saved address');
      const saved = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId } });
      if (!saved) throw new NotFoundException('Address not found');
      return {
        fullName: saved.fullName,
        phone: saved.phone,
        line1: saved.line1,
        line2: saved.line2,
        city: saved.city,
        state: saved.state,
        postalCode: saved.postalCode,
        countryCode: saved.countryCode,
      };
    }
    if (!dto.address) throw new BadRequestException('A shipping address is required');
    if (userId && dto.saveAddress) {
      const count = await this.prisma.address.count({ where: { userId } });
      await this.prisma.address.create({
        data: { ...dto.address, userId, isDefault: count === 0 },
      });
    }
    return { ...dto.address };
  }

  private async createOrder(args: {
    online: boolean;
    holdMinutes: number | undefined;
    cartRow: Prisma.CartGetPayload<{
      include: {
        items: { include: { variant: { include: { product: { include: { vendor: true } } } } } };
      };
    }>;
    quote: CheckoutQuoteDto;
    dto: PlaceOrderDto;
    email: string;
    userId: string | null;
    address: ShippingAddress;
    commissionRate: CommissionResolver;
  }): Promise<OrderFull> {
    const { cartRow, quote, dto, email, userId, address, commissionRate, online, holdMinutes } =
      args;
    const prepaid = dto.paymentMethod === 'GIFT_CARD'; // fully covered by gift card / points
    const initialStatus = online
      ? ('PENDING_PAYMENT' as const)
      : prepaid
        ? ('PAID' as const)
        : ('COD_CONFIRMED' as const);

    const gatewayName = online ? await this.payments.activeProviderName() : '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderNumber = generateOrderNumber();
      try {
        const orderId = await this.prisma.$transaction(
          async (tx) => {
            const order = await tx.order.create({
              data: {
                orderNumber,
                userId,
                email,
                status: initialStatus,
                currency: quote.currency,
                subtotal: quote.subtotal,
                shippingTotal: quote.shippingTotal,
                discountTotal: quote.discountTotal,
                couponCode: quote.coupon?.applied ? quote.coupon.code : null,
                loyaltyDiscount: quote.loyalty?.amount ?? 0,
                giftCardTotal: quote.giftCard?.applied ? quote.giftCard.amount : 0,
                taxTotal: quote.taxTotal,
                taxAdded: quote.taxAdded,
                grandTotal: quote.grandTotal,
                shippingAddress: address as unknown as Prisma.InputJsonValue,
                paymentMethod: dto.paymentMethod,
                paymentStatus: prepaid ? 'PAID' : 'PENDING',
                customerNote: dto.customerNote ?? null,
                idempotencyKey: dto.idempotencyKey,
              },
            });

            await reserveStock(
              tx,
              order.id,
              cartRow.items.map((i) => ({
                variantId: i.variantId,
                quantity: i.quantity,
                label: `${i.variant.product.name}${i.variant.name ? ` (${i.variant.name})` : ''}`,
              })),
              holdMinutes,
            );

            for (const group of quote.groups) {
              const taxOf = new Map(group.taxLines.map((t) => [t.itemId, t]));
              // Each item gets the most specific rule (seller+category → seller → category → global).
              // Commission is charged on the price without tax (tax belongs to the seller).
              const commission = commissionForLines(
                cartRow.items
                  .filter((i) => i.variant.product.vendorId === group.vendor.id)
                  .map((i) => ({
                    amount: preTaxAmount(
                      toCents(Number(i.variant.price)) * i.quantity,
                      taxOf.get(i.id),
                    ),
                    rate: commissionRate({
                      vendorId: i.variant.product.vendorId,
                      categoryId: i.variant.product.categoryId,
                    }).rate,
                  })),
              );
              const vendorOrder = await tx.vendorOrder.create({
                data: {
                  orderId: order.id,
                  vendorId: group.vendor.id,
                  status: initialStatus,
                  shippingRateId: group.shippingRateId,
                  shippingMethod: group.shippingMethod,
                  discountTotal: fromCents(toCents(group.discount) + toCents(group.tenders)),
                  subtotal: group.subtotal,
                  shippingTotal: group.shipping,
                  commissionAmount: commission,
                  taxTotal: group.tax,
                  taxAdded: group.taxAdded,
                  // Seller keeps the tax (included tax is already in subtotal; added tax on top).
                  netAmount: fromCents(
                    toCents(group.subtotal) +
                      toCents(group.shipping) +
                      toCents(group.taxAdded) -
                      toCents(commission) -
                      toCents(group.sellerFundedDiscount),
                  ),
                },
              });
              await tx.orderItem.createMany({
                data: cartRow.items
                  .filter((i) => i.variant.product.vendorId === group.vendor.id)
                  .map((i) => ({
                    orderId: order.id,
                    vendorOrderId: vendorOrder.id,
                    variantId: i.variantId,
                    productName: i.variant.product.name,
                    variantName: i.variant.name,
                    sku: i.variant.sku,
                    quantity: i.quantity,
                    unitPrice: i.variant.price,
                    total: fromCents(toCents(Number(i.variant.price)) * i.quantity),
                    tax: taxOf.get(i.id)?.amount ?? 0,
                    taxRate: taxOf.has(i.id) ? taxOf.get(i.id)!.rate / 100 : null,
                    taxInclusive: taxOf.get(i.id)?.inclusive ?? false,
                    taxName: taxOf.get(i.id)?.name ?? null,
                  })),
              });
              await tx.orderStatusHistory.create({
                data: {
                  orderId: order.id,
                  vendorOrderId: vendorOrder.id,
                  toStatus: initialStatus,
                  note: 'Order placed',
                },
              });
            }

            await tx.orderStatusHistory.create({
              data: {
                orderId: order.id,
                toStatus: initialStatus,
                note: online ? 'Order placed, waiting for payment' : 'Order placed',
              },
            });
            await tx.payment.create({
              data: {
                orderId: order.id,
                method: dto.paymentMethod,
                provider: online ? gatewayName : prepaid ? 'internal' : 'cod',
                status: prepaid ? 'PAID' : 'PENDING',
                amount: quote.grandTotal,
                currency: quote.currency,
              },
            });
            if (quote.coupon?.applied) {
              const couponLine = quote.discounts.find((d) => d.source === 'coupon');
              await this.promotions.recordUsage(
                tx,
                quote.coupon.code,
                order.id,
                userId,
                couponLine?.amount ?? 0,
              );
            }
            if (quote.loyalty && quote.loyalty.pointsUsed > 0 && userId) {
              await this.loyalty.redeemInTx(
                tx,
                userId,
                quote.loyalty.pointsUsed,
                order.id,
                orderNumber,
              );
            }
            if (quote.giftCard?.applied) {
              await this.giftCards.redeemInTx(
                tx,
                quote.giftCard.code,
                quote.giftCard.amount,
                order.id,
              );
            }
            await tx.cartItem.deleteMany({ where: { cartId: cartRow.id } });
            return order.id;
          },
          { timeout: 20_000 },
        );
        return this.prisma.order.findUniqueOrThrow({
          where: { id: orderId },
          include: orderInclude,
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        const target = String((error as { meta?: { target?: unknown } }).meta?.target ?? '');
        if (code === 'P2002' && target.includes('orderNumber')) continue; // rare collision → new number
        throw error;
      }
    }
    throw new BadRequestException('Could not create the order, please try again');
  }
}

/** Line amount without its included tax (for commission). Exclusive tax is not part of the price. */
function preTaxAmount(
  cents: number,
  tax: { rate: number; inclusive: boolean } | undefined,
): number {
  if (!tax?.inclusive) return fromCents(cents);
  return fromCents(cents - lineTaxCents(cents, tax.rate / 100, true));
}
