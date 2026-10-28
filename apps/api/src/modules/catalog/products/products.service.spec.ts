import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import { ProductsService } from './products.service';

const now = new Date('2026-01-01T00:00:00Z');
const approvedVendor = { id: 'v1', ownerId: 'u1', status: 'APPROVED', email: 'seller@example.com' };

const variant = (over: Record<string, unknown> = {}) => ({
  id: 'var1',
  sku: 'PH-1',
  name: null,
  price: 100,
  compareAtPrice: null,
  isDefault: true,
  isActive: true,
  position: 0,
  attributes: [],
  _count: { orderItems: 0 },
  ...over,
});

const product = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  vendorId: 'v1',
  name: 'Phone',
  slug: 'phone',
  status: 'DRAFT',
  shortDescription: null,
  description: 'A great phone with a long description.',
  specifications: [],
  basePrice: 100,
  compareAtPrice: null,
  currency: 'USD',
  weightGrams: null,
  videoUrl: null,
  seoTitle: null,
  seoDescription: null,
  isFeatured: false,
  rejectionReason: null,
  publishedAt: null,
  createdAt: now,
  updatedAt: now,
  category: { id: 'c1', name: 'Phones', slug: 'phones' },
  brand: null,
  vendor: { id: 'v1', name: 'Demo', slug: 'demo' },
  images: [{ id: 'i1', url: 'http://img/1.png', altText: null, position: 0 }],
  variants: [variant()],
  ...over,
});

const attrValue = (id: string, attributeId: string, label: string, position = 0) => ({
  id,
  attributeId,
  value: label.toLowerCase(),
  label,
  swatch: null,
  position: 0,
  attribute: {
    id: attributeId,
    name: attributeId === 'color' ? 'Color' : 'Storage',
    code: attributeId,
    type: 'select',
    position,
  },
});

function setup() {
  const tx = {
    product: { update: jest.fn() },
    productVariant: {
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(({ where }) => Promise.resolve({ id: where.id })),
      create: jest.fn(() => Promise.resolve({ id: 'new-var' })),
    },
    productVariantAttribute: { deleteMany: jest.fn(), createMany: jest.fn() },
    productImage: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    vendor: {
      findFirst: jest.fn().mockResolvedValue(approvedVendor),
      findUnique: jest.fn().mockResolvedValue(approvedVendor),
    },
    category: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
    brand: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
    productVariant: { findMany: jest.fn().mockResolvedValue([]) },
    attributeValue: { findMany: jest.fn().mockResolvedValue([]) },
    currency: { findFirst: jest.fn().mockResolvedValue({ code: 'PKR' }) },
    setting: { findUnique: jest.fn().mockResolvedValue({ value: true }) },
    product: {
      findFirst: jest.fn(),
      create: jest.fn(({ data }) =>
        Promise.resolve(product({ ...data, variants: [variant()], images: [] })),
      ),
      update: jest.fn(({ data }) => Promise.resolve(product(data))),
    },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const audit = { log: jest.fn() };
  const notifications = { sendEmail: jest.fn() };
  const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
  const service = new ProductsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    notifications as unknown as NotificationsService,
    config as unknown as ConfigService,
  );
  return { prisma, tx, notifications, service };
}

const input = { name: 'Phone', categoryId: 'c1', basePrice: 100, sku: 'PH-1' };

describe('ProductsService — products', () => {
  it('only approved stores can create products', async () => {
    const { prisma, service } = setup();
    prisma.vendor.findFirst.mockResolvedValue({ ...approvedVendor, status: 'PENDING' });
    await expect(service.create('u1', input)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a draft with a default variant in the platform currency', async () => {
    const { prisma, service } = setup();
    prisma.product.findFirst.mockResolvedValue(null);

    await service.create('u1', input);

    const data = prisma.product.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'DRAFT', currency: 'PKR', vendorId: 'v1', slug: 'phone' });
    expect(data.variants.create).toMatchObject({ sku: 'PH-1', price: 100, isDefault: true });
  });

  it('rejects a SKU used by another product', async () => {
    const { prisma, service } = setup();
    prisma.productVariant.findMany.mockResolvedValue([{ sku: 'PH-1' }]);
    await expect(service.create('u1', input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a compare-at price that is not higher than the price', async () => {
    const { service } = setup();
    await expect(service.create('u1', { ...input, compareAtPrice: 90 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('submits a complete draft for review when approval is required', async () => {
    const { prisma, service } = setup();
    prisma.product.findFirst.mockResolvedValue(product());
    const result = await service.submit('u1', 'p1');
    expect(prisma.product.update.mock.calls[0][0].data).toMatchObject({
      status: 'PENDING_REVIEW',
      rejectionReason: null,
    });
    expect(result.status).toBe('PENDING_REVIEW');
  });

  it('refuses to submit a product without images', async () => {
    const { prisma, service } = setup();
    prisma.product.findFirst.mockResolvedValue(product({ images: [] }));
    await expect(service.submit('u1', 'p1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cannot see another store's product", async () => {
    const { prisma, service } = setup();
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(service.vendorGet('u1', 'someone-elses')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ProductsService — variants', () => {
  const colorStorage = [
    attrValue('black', 'color', 'Black', 0),
    attrValue('white', 'color', 'White', 0),
    attrValue('128', 'storage', '128GB', 1),
  ];

  it('creates option variants, labels them and sets the cheapest price on the product', async () => {
    const { prisma, tx, service } = setup();
    prisma.product.findFirst.mockResolvedValue(product());
    prisma.attributeValue.findMany.mockResolvedValue(colorStorage);

    await service.saveVariants('u1', 'p1', [
      { id: 'var1', sku: 'PH-BLK-128', price: 120, isActive: true, valueIds: ['black', '128'] },
      { sku: 'PH-WHT-128', price: 110, isActive: true, valueIds: ['128', 'white'] },
    ]);

    expect(tx.productVariant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'var1' },
        data: expect.objectContaining({ name: 'Black / 128GB', isDefault: true }),
      }),
    );
    expect(tx.productVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sku: 'PH-WHT-128', name: 'White / 128GB', productId: 'p1' }),
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { basePrice: 110, compareAtPrice: null },
    });
  });

  it('rejects duplicate combinations', async () => {
    const { prisma, service } = setup();
    prisma.product.findFirst.mockResolvedValue(product());
    prisma.attributeValue.findMany.mockResolvedValue(colorStorage);
    await expect(
      service.saveVariants('u1', 'p1', [
        { sku: 'A1', price: 10, isActive: true, valueIds: ['black'] },
        { sku: 'A2', price: 10, isActive: true, valueIds: ['black'] },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects variants that use different attributes', async () => {
    const { prisma, service } = setup();
    prisma.product.findFirst.mockResolvedValue(product());
    prisma.attributeValue.findMany.mockResolvedValue(colorStorage);
    await expect(
      service.saveVariants('u1', 'p1', [
        { sku: 'A1', price: 10, isActive: true, valueIds: ['black'] },
        { sku: 'A2', price: 10, isActive: true, valueIds: ['128'] },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deactivates (not deletes) removed variants that were ordered', async () => {
    const { prisma, tx, service } = setup();
    prisma.product.findFirst.mockResolvedValue(
      product({
        variants: [
          variant(),
          variant({ id: 'ordered', sku: 'OLD', isDefault: false, _count: { orderItems: 3 } }),
        ],
      }),
    );

    await service.saveVariants('u1', 'p1', [
      { id: 'var1', sku: 'PH-1', price: 100, isActive: true, valueIds: [] },
    ]);

    expect(tx.productVariant.deleteMany).not.toHaveBeenCalled();
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['ordered'] } },
      data: { isActive: false, isDefault: false },
    });
  });
});

describe('ProductsService — moderation', () => {
  it('approves a product in review and emails the vendor', async () => {
    const { prisma, notifications, service } = setup();
    prisma.product.findFirst.mockResolvedValue(product({ status: 'PENDING_REVIEW' }));

    const result = await service.approve('p1', 'admin');

    const data = prisma.product.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'PUBLISHED', rejectionReason: null });
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(result.status).toBe('PUBLISHED');
    expect(notifications.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'vendor.product-approved' }),
    );
  });

  it('rejects with a reason and unfeatures the product', async () => {
    const { prisma, service } = setup();
    prisma.product.findFirst.mockResolvedValue(product({ status: 'PUBLISHED', isFeatured: true }));

    await service.reject('p1', 'Images show a different product', 'admin');

    expect(prisma.product.update.mock.calls[0][0].data).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Images show a different product',
      isFeatured: false,
    });
  });

  it('cannot approve a draft', async () => {
    const { prisma, service } = setup();
    prisma.product.findFirst.mockResolvedValue(product({ status: 'DRAFT' }));
    await expect(service.approve('p1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only published products can be featured', async () => {
    const { prisma, service } = setup();
    prisma.product.findFirst.mockResolvedValue(product({ status: 'PENDING_REVIEW' }));
    await expect(service.setFeatured('p1', true)).rejects.toBeInstanceOf(BadRequestException);
  });
});
