import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { CartService } from './cart.service';

const variant = (over: Record<string, unknown> = {}) => ({
  id: 'var1',
  sku: 'SKU-1',
  name: null,
  price: 100,
  isActive: true,
  product: {
    id: 'p1',
    name: 'Phone',
    slug: 'phone',
    status: 'PUBLISHED',
    deletedAt: null,
    currency: 'USD',
    vendor: { id: 'v1', name: 'Demo', slug: 'demo', status: 'APPROVED' },
    images: [],
  },
  ...over,
});

const item = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  cartId: 'c1',
  variantId: 'var1',
  quantity: 1,
  unitPrice: 100,
  createdAt: new Date(),
  variant: variant(),
  ...over,
});

function setup(available: number) {
  const tx = { cartItem: { update: jest.fn(), create: jest.fn() }, cart: { delete: jest.fn() } };
  const prisma = {
    productVariant: { findUnique: jest.fn().mockResolvedValue(variant()) },
    stockLevel: {
      groupBy: jest
        .fn()
        .mockResolvedValue([{ variantId: 'var1', _sum: { quantity: available, reserved: 0 } }]),
    },
    cart: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    cartItem: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const service = new CartService(prisma as unknown as PrismaService);
  return { prisma, tx, service };
}

describe('CartService', () => {
  it('creates a guest cart and adds the item', async () => {
    const { prisma, service } = setup(5);
    prisma.cart.findUnique.mockResolvedValue(null);
    prisma.cart.create.mockResolvedValue({ id: 'c1', currency: 'USD', items: [] });
    prisma.cart.findUniqueOrThrow.mockResolvedValue({
      id: 'c1',
      currency: 'USD',
      items: [item({ quantity: 2 })],
    });

    const cart = await service.addItem({ sessionId: 's1' }, { variantId: 'var1', quantity: 2 });

    expect(prisma.cart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { sessionId: 's1', currency: 'USD' } }),
    );
    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: { cartId: 'c1', variantId: 'var1', quantity: 2, unitPrice: 100 },
    });
    expect(cart).toMatchObject({ itemCount: 2, subtotal: 200, canCheckout: true });
  });

  it('refuses more than the available stock, counting what is already in the cart', async () => {
    const { prisma, service } = setup(3);
    prisma.cart.findUnique.mockResolvedValue({
      id: 'c1',
      currency: 'USD',
      items: [item({ quantity: 2 })],
    });
    await expect(
      service.addItem({ sessionId: 's1' }, { variantId: 'var1', quantity: 2 }),
    ).rejects.toThrow(/Only 3 left in stock/);
  });

  it('refuses products that are not published', async () => {
    const { prisma, service } = setup(5);
    prisma.productVariant.findUnique.mockResolvedValue(
      variant({ product: { ...variant().product, status: 'ARCHIVED' } }),
    );
    await expect(
      service.addItem({ sessionId: 's1' }, { variantId: 'var1', quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses out-of-stock items', async () => {
    const { service } = setup(0);
    await expect(
      service.addItem({ sessionId: 's1' }, { variantId: 'var1', quantity: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('flags price changes and stock problems when reading the cart', async () => {
    const { prisma, service } = setup(1);
    prisma.cart.findUnique.mockResolvedValue({
      id: 'c1',
      currency: 'USD',
      items: [item({ quantity: 2, unitPrice: 90 })],
    });

    const cart = await service.getCart({ sessionId: 's1' });

    expect(cart.groups[0].items[0]).toMatchObject({
      problems: ['INSUFFICIENT_STOCK', 'PRICE_CHANGED'],
      previousUnitPrice: 90,
      unitPrice: 100,
    });
    expect(cart.canCheckout).toBe(false);
    expect(cart.subtotal).toBe(0);
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { unitPrice: 100 },
    });
  });

  it('merges the guest cart into the user cart at sign-in, capped by stock', async () => {
    const { prisma, tx, service } = setup(3);
    prisma.cart.findUnique
      .mockResolvedValueOnce({
        id: 'guest',
        userId: null,
        currency: 'USD',
        items: [{ variantId: 'var1', quantity: 2, unitPrice: 100 }],
      })
      .mockResolvedValueOnce({
        id: 'user-cart',
        currency: 'USD',
        items: [item({ cartId: 'user-cart', quantity: 3 })],
      });
    prisma.cart.upsert.mockResolvedValue({
      id: 'user-cart',
      items: [{ id: 'i1', variantId: 'var1', quantity: 2 }],
    });

    await service.getCart({ userId: 'u1', sessionId: 'guest-session' });

    expect(tx.cartItem.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { quantity: 3 } });
    expect(tx.cart.delete).toHaveBeenCalledWith({ where: { id: 'guest' } });
  });
});
