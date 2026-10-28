/**
 * Full demo store activity on top of the demo catalogue (run seed-catalog.ts first):
 * 3 customers with addresses, wishlists and loyalty points; orders across both stores in every
 * stage (pending, confirmed, processing, shipped, delivered, cancelled); shipments; returns
 * (requested, approved, refunded); reviews (approved + waiting for moderation, some with seller
 * replies); and product questions with seller answers.
 *
 *   docker exec ecommerce-app sh -c "cd /app/packages/database && ./node_modules/.bin/tsx prisma/seed-flow.ts"
 *
 * Runs once: if the demo customers already have orders it stops without changing anything.
 */
import { Prisma, PrismaClient, type OrderStatus, type PaymentMethod } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const D = (n: number) => new Prisma.Decimal(Math.round(n * 100) / 100);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const pick = <T,>(list: T[], i: number) => list[i % list.length]!;
const code = (n = 5) =>
  Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

const CUSTOMERS = [
  { email: 'ali@example.com', first: 'Ali', last: 'Raza', city: 'Lahore', line1: '12 Mall Road', phone: '+923001112233' },
  { email: 'ayesha@example.com', first: 'Ayesha', last: 'Malik', city: 'Karachi', line1: '45 Clifton Block 5', phone: '+923214445566' },
  { email: 'bilal@example.com', first: 'Bilal', last: 'Ahmed', city: 'Islamabad', line1: '7 F-8 Markaz', phone: '+923337778899' },
];

const REVIEWS = [
  [5, 'Exactly as described', 'Arrived quickly and well packed. Quality is excellent for the price.'],
  [4, 'Very good', 'Works great. Delivery took a day longer than expected but the seller kept me updated.'],
  [5, 'Love it', 'Second time buying from this store. Highly recommended!'],
  [3, 'Decent', 'Good overall, but the colour is slightly different from the photos.'],
  [4, 'Good value', 'Solid product, does what it says. Would buy again.'],
] as const;

const QUESTIONS = [
  ['Does this come with a warranty?', 'Yes, it comes with a 1-year seller warranty.'],
  ['Is cash on delivery available in Quetta?', 'Yes, we deliver with cash on delivery all over Pakistan.'],
  ['How long does delivery take?', 'Usually 2–4 working days in major cities.'],
  ['Is the box sealed?', 'Yes, every item ships brand new and sealed.'],
] as const;

/** One scripted order per row: [customer, status, payment, days ago, items (vendor-mixed)]. */
const PLAN: [number, OrderStatus, PaymentMethod, number, number][] = [
  [0, 'DELIVERED', 'COD', 40, 3],
  [0, 'DELIVERED', 'CARD', 25, 2],
  [0, 'SHIPPED', 'COD', 3, 2],
  [0, 'PENDING_PAYMENT', 'CARD', 0, 1],
  [1, 'DELIVERED', 'CARD', 35, 2],
  [1, 'DELIVERED', 'COD', 18, 3],
  [1, 'PROCESSING', 'CARD', 2, 2],
  [1, 'CANCELLED', 'COD', 12, 1],
  [2, 'DELIVERED', 'COD', 30, 2],
  [2, 'OUT_FOR_DELIVERY', 'COD', 1, 2],
  [2, 'COD_CONFIRMED', 'COD', 0, 3],
  [2, 'PACKED', 'CARD', 1, 1],
];

const PATH: OrderStatus[] = ['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

async function main() {
  const first = await prisma.user.findUnique({
    where: { email: CUSTOMERS[0]!.email },
    include: { _count: { select: { orders: true } } },
  });
  if (first && first._count.orders > 0) {
    console.log('Demo activity already exists — nothing to do.');
    return;
  }

  const vendors = await prisma.vendor.findMany({
    where: { slug: { in: ['demo-electronics', 'style-street'] }, status: 'APPROVED' },
  });
  if (vendors.length < 2) throw new Error('Run prisma/seed-catalog.ts first (needs both demo stores).');

  // In-stock products per store, with their default variant.
  const stock = new Map<string, { productId: string; variantId: string; name: string; variantName: string | null; sku: string; price: number }[]>();
  for (const v of vendors) {
    const rows = await prisma.product.findMany({
      where: { vendorId: v.id, status: 'PUBLISHED', deletedAt: null },
      include: { variants: { where: { isDefault: true }, take: 1 } },
      orderBy: { soldCount: 'desc' },
      take: 40,
    });
    stock.set(
      v.id,
      rows
        .filter((p) => p.variants[0])
        .map((p) => ({
          productId: p.id,
          variantId: p.variants[0]!.id,
          name: p.name,
          variantName: p.variants[0]!.name,
          sku: p.variants[0]!.sku,
          price: Number(p.variants[0]!.price),
        })),
    );
  }

  const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CUSTOMER' } });
  const tiers = await prisma.tier.findMany({ orderBy: { minPoints: 'asc' } });
  const passwordHash = await argon2.hash('Customer@12345');
  const courier = await prisma.courier.findFirst();

  // ---- customers, addresses, wishlists
  const users = [];
  for (const [i, c] of CUSTOMERS.entries()) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        firstName: c.first,
        lastName: c.last,
        phone: c.phone,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: { roleId: customerRole.id } },
        emailPreference: { create: {} },
      },
    });
    const address = await prisma.address.create({
      data: {
        userId: user.id,
        label: 'Home',
        fullName: `${c.first} ${c.last}`,
        phone: c.phone,
        line1: c.line1,
        city: c.city,
        state: 'Punjab',
        postalCode: '54000',
        countryCode: 'PK',
        isDefault: true,
      },
    });
    await prisma.address.create({
      data: {
        userId: user.id,
        label: 'Office',
        fullName: `${c.first} ${c.last}`,
        phone: c.phone,
        line1: `Office ${i + 3}, Business Avenue`,
        city: c.city,
        countryCode: 'PK',
      },
    });
    const wishlist =
      (await prisma.wishlist.findFirst({ where: { userId: user.id, isDefault: true } })) ??
      (await prisma.wishlist.create({ data: { userId: user.id } }));
    const all = [...stock.values()].flat();
    for (let k = 0; k < 4; k++) {
      const p = pick(all, i * 7 + k * 3 + 5);
      await prisma.wishlistItem
        .create({ data: { wishlistId: wishlist.id, productId: p.productId, priceAtAdd: D(p.price) } })
        .catch(() => undefined);
    }
    users.push({ user, address });
  }

  // ---- orders
  const delivered: { orderId: string; userId: string; items: { id: string; productId: string; vendorOrderId: string; total: number; quantity: number }[]; vendorOrderIds: string[] }[] = [];
  const earned = new Map<string, { points: number; orderId: string; at: Date }[]>();
  let n = 0;
  for (const [ci, status, method, ago, count] of PLAN) {
    const { user, address } = users[ci]!;
    const placedAt = daysAgo(ago);
    // Spread lines over both stores so most orders are multi-vendor.
    const lines = Array.from({ length: count }, (_, k) => {
      const v = vendors[(n + k) % vendors.length]!;
      const p = pick(stock.get(v.id)!, n * 3 + k);
      return { vendor: v, p, quantity: 1 + ((n + k) % 2) };
    });
    n++;
    const subtotal = lines.reduce((s, l) => s + l.p.price * l.quantity, 0);
    const shipping = subtotal > 100 ? 0 : 5;
    const grand = subtotal + shipping;
    const paid = method === 'CARD' ? status !== 'PENDING_PAYMENT' : status === 'DELIVERED';
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${placedAt.toISOString().slice(2, 10).replace(/-/g, '')}-${code()}`,
        userId: user.id,
        email: user.email,
        status,
        currency: 'USD',
        subtotal: D(subtotal),
        shippingTotal: D(shipping),
        grandTotal: D(grand),
        shippingAddress: {
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          countryCode: address.countryCode,
        },
        paymentMethod: method,
        paymentStatus: status === 'CANCELLED' ? 'CANCELLED' : paid ? 'PAID' : 'PENDING',
        placedAt,
        createdAt: placedAt,
        cancelledAt: status === 'CANCELLED' ? daysAgo(ago - 1) : null,
        cancelReason: status === 'CANCELLED' ? 'Ordered by mistake' : null,
      },
    });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        method,
        provider: method === 'CARD' ? 'stripe' : 'cod',
        status: status === 'CANCELLED' ? 'CANCELLED' : paid ? 'PAID' : 'PENDING',
        amount: D(grand),
        currency: 'USD',
        providerRef: method === 'CARD' ? `pi_demo_${code(12)}` : null,
        createdAt: placedAt,
      },
    });

    const items: (typeof delivered)[number]['items'] = [];
    const vendorOrderIds: string[] = [];
    for (const v of vendors) {
      const mine = lines.filter((l) => l.vendor.id === v.id);
      if (mine.length === 0) continue;
      const vSub = mine.reduce((s, l) => s + l.p.price * l.quantity, 0);
      const commission = vSub * 0.1;
      const vo = await prisma.vendorOrder.create({
        data: {
          orderId: order.id,
          vendorId: v.id,
          status,
          subtotal: D(vSub),
          commissionAmount: D(commission),
          netAmount: D(vSub - commission),
          shippingMethod: 'Standard delivery',
          createdAt: placedAt,
        },
      });
      vendorOrderIds.push(vo.id);
      for (const l of mine) {
        const it = await prisma.orderItem.create({
          data: {
            orderId: order.id,
            vendorOrderId: vo.id,
            variantId: l.p.variantId,
            productName: l.p.name,
            variantName: l.p.variantName,
            sku: l.p.sku,
            quantity: l.quantity,
            unitPrice: D(l.p.price),
            total: D(l.p.price * l.quantity),
          },
        });
        items.push({ id: it.id, productId: l.p.productId, vendorOrderId: vo.id, total: l.p.price * l.quantity, quantity: l.quantity });
      }
      if (['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
        await prisma.shipment.create({
          data: {
            vendorOrderId: vo.id,
            courierId: courier?.id,
            trackingNumber: `TRK${code(9)}`,
            status: status === 'DELIVERED' ? 'DELIVERED' : status === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'IN_TRANSIT',
            shippedAt: daysAgo(Math.max(0, ago - 2)),
            deliveredAt: status === 'DELIVERED' ? daysAgo(Math.max(0, ago - 4)) : null,
          },
        });
      }
    }

    // Status history: the path the order took to reach its current status.
    const history: OrderStatus[] =
      status === 'PENDING_PAYMENT'
        ? ['PENDING_PAYMENT']
        : status === 'CANCELLED'
          ? [method === 'COD' ? 'COD_CONFIRMED' : 'PAID', 'CANCELLED']
          : [method === 'COD' ? 'COD_CONFIRMED' : 'PAID', ...PATH.slice(0, PATH.indexOf(status) + 1)];
    let prev: OrderStatus | null = null;
    for (const [h, to] of history.entries()) {
      await prisma.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: prev, toStatus: to, createdAt: daysAgo(Math.max(0, ago - h)) },
      });
      prev = to;
    }

    if (status === 'DELIVERED') {
      delivered.push({ orderId: order.id, userId: user.id, items, vendorOrderIds });
      const list = earned.get(user.id) ?? [];
      list.push({ points: Math.round(grand), orderId: order.id, at: daysAgo(Math.max(0, ago - 4)) });
      earned.set(user.id, list);
      for (const it of items)
        await prisma.product.update({ where: { id: it.productId }, data: { soldCount: { increment: it.quantity } } });
    }
  }

  // ---- loyalty points (earned on delivered orders, one redemption)
  for (const [i, { user }] of users.entries()) {
    const list = earned.get(user.id) ?? [];
    const total = list.reduce((s, e) => s + e.points, 0) + 250; // + welcome bonus
    const redeemed = i === 0 ? 200 : 0;
    const balance = total - redeemed;
    const tier = [...tiers].reverse().find((t) => total >= t.minPoints) ?? null;
    const account = await prisma.loyaltyAccount.upsert({
      where: { userId: user.id },
      update: { points: balance, lifetimePoints: total, tierId: tier?.id ?? null },
      create: {
        userId: user.id,
        points: balance,
        lifetimePoints: total,
        tierId: tier?.id ?? null,
        referralCode: `R${code(7)}`,
      },
    });
    await prisma.pointsTransaction.create({
      data: { accountId: account.id, type: 'ADJUST', points: 250, description: 'Welcome bonus', createdAt: daysAgo(45) },
    });
    for (const e of list)
      await prisma.pointsTransaction.create({
        data: { accountId: account.id, type: 'EARN', points: e.points, orderId: e.orderId, description: 'Points for a delivered order', createdAt: e.at },
      });
    if (redeemed)
      await prisma.pointsTransaction.create({
        data: { accountId: account.id, type: 'REDEEM', points: -redeemed, description: 'Redeemed at checkout', createdAt: daysAgo(5) },
      });
  }

  // ---- returns on delivered orders: refunded, approved, waiting
  const RETURNS = [
    { idx: 0, status: 'REFUNDED' as const, reason: 'Item arrived damaged' },
    { idx: 2, status: 'APPROVED' as const, reason: 'Wrong size' },
    { idx: 3, status: 'REQUESTED' as const, reason: 'Changed my mind' },
  ];
  for (const r of RETURNS) {
    const d = delivered[r.idx];
    const item = d?.items[0];
    if (!d || !item) continue;
    const refund = item.total / item.quantity;
    await prisma.returnRequest.create({
      data: {
        rmaNumber: `RMA-${code(6)}`,
        orderId: d.orderId,
        userId: d.userId,
        vendorOrderId: item.vendorOrderId,
        status: r.status,
        resolution: 'REFUND',
        reason: r.reason,
        comments: 'Please arrange a pickup from my address.',
        refundAmount: r.status === 'REFUNDED' ? D(refund) : null,
        refundedAt: r.status === 'REFUNDED' ? daysAgo(2) : null,
        decisionNote: r.status === 'REQUESTED' ? null : 'Approved — courier will collect the item.',
        items: { create: { orderItemId: item.id, quantity: 1, condition: 'Unused', restocked: r.status === 'REFUNDED' } },
      },
    });
  }

  // ---- reviews on delivered items (approved + pending moderation, some seller replies)
  let r = 0;
  for (const d of delivered) {
    for (const it of d.items) {
      const [rating, title, body] = pick([...REVIEWS], r);
      await prisma.review
        .create({
          data: {
            productId: it.productId,
            userId: d.userId,
            orderItemId: it.id,
            rating,
            title,
            body,
            status: r % 5 === 4 ? 'PENDING' : 'APPROVED',
            vendorReply: r % 3 === 0 ? 'Thank you for shopping with us! 💜' : null,
            helpfulCount: (r * 7) % 23,
          },
        })
        .catch(() => undefined);
      r++;
    }
  }

  // ---- questions with seller answers (one left unanswered, one awaiting moderation)
  const products = [...stock.values()].flatMap((l) => l.slice(0, 4));
  for (const [i, p] of products.entries()) {
    const [q, a] = pick([...QUESTIONS], i);
    const question = await prisma.question.create({
      data: {
        productId: p.productId,
        userId: users[i % users.length]!.user.id,
        body: q,
        status: i === products.length - 1 ? 'PENDING' : 'APPROVED',
        createdAt: daysAgo(10 - (i % 9)),
      },
    });
    if (i % 4 !== 3)
      await prisma.answer.create({ data: { questionId: question.id, isVendor: true, body: a } });
  }

  console.log(
    `Done: ${CUSTOMERS.length} customers, ${PLAN.length} orders, ${RETURNS.length} returns, ${r} reviews, ${products.length} questions.`,
  );
  console.log(`Customers: ${CUSTOMERS.map((c) => c.email).join(', ')} — password Customer@12345`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
