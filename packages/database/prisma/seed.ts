/* eslint-disable no-console */
import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ROLES: { name: string; description: string }[] = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full access including system settings, roles and permissions',
  },
  { name: 'ADMIN', description: 'Full platform control' },
  { name: 'CONTENT_MANAGER', description: 'CMS pages, banners, menus, blog' },
  { name: 'MARKETING_MANAGER', description: 'Coupons, promotions, email campaigns' },
  { name: 'SUPPORT_AGENT', description: 'Tickets, returns, customer queries' },
  { name: 'WAREHOUSE_STAFF', description: 'Picking, packing, shipping' },
  { name: 'VENDOR', description: 'Marketplace seller (store owner)' },
  { name: 'VENDOR_STAFF', description: 'Sub-user of a vendor' },
  { name: 'CUSTOMER', description: 'Registered shopper' },
];

const PERMISSION_GROUPS: Record<string, string[]> = {
  catalog: [
    'product.read',
    'product.create',
    'product.update',
    'product.delete',
    'product.approve',
    'category.manage',
  ],
  inventory: ['stock.read', 'stock.adjust', 'warehouse.manage'],
  orders: ['order.read', 'order.update', 'order.refund', 'order.create'],
  returns: ['return.read', 'return.process'],
  customers: ['customer.read', 'customer.update', 'customer.block'],
  vendors: [
    'vendor.read',
    'vendor.approve',
    'vendor.suspend',
    'payout.manage',
    'commission.manage',
  ],
  promotions: ['coupon.manage', 'promotion.manage', 'giftcard.manage'],
  loyalty: ['loyalty.manage'],
  cms: ['page.manage', 'banner.manage', 'menu.manage', 'blog.manage', 'faq.manage'],
  marketing: ['campaign.manage', 'subscriber.manage'],
  support: ['ticket.read', 'ticket.reply', 'review.moderate', 'dispute.manage'],
  reports: ['report.read', 'report.export'],
  settings: [
    'settings.manage',
    'role.manage',
    'user.manage',
    'email-template.manage',
    'audit.read',
  ],
};

const ROLE_PERMISSION_GROUPS: Record<string, string[] | '*'> = {
  SUPER_ADMIN: '*',
  ADMIN: Object.keys(PERMISSION_GROUPS).filter((g) => g !== 'settings'),
  CONTENT_MANAGER: ['cms'],
  MARKETING_MANAGER: ['promotions', 'marketing', 'loyalty', 'reports'],
  SUPPORT_AGENT: ['support', 'returns', 'customers'],
  WAREHOUSE_STAFF: ['inventory'],
};

async function seedRbac() {
  const permissionKeys = Object.entries(PERMISSION_GROUPS).flatMap(([group, perms]) =>
    perms.map((p) => `${group}.${p}`),
  );

  for (const key of permissionKeys) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }

  for (const role of ROLES) {
    const saved = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { ...role, isSystem: true },
    });

    const groups = ROLE_PERMISSION_GROUPS[role.name];
    if (!groups) continue;
    const keys =
      groups === '*'
        ? permissionKeys
        : permissionKeys.filter((k) => groups.includes(k.split('.')[0]!));
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: saved.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  // Area permissions (view / manage) enforced by RolesGuard for custom roles (Step 24).
  // Keep in sync with ADMIN_AREAS / BUILT_IN_ROLE_AREAS in packages/types/src/rbac/rbac.ts (the seed can't import types).
  const AREAS = [
    'catalog',
    'orders',
    'returns',
    'customers',
    'vendors',
    'inventory',
    'shipping',
    'promotions',
    'loyalty',
    'cms',
    'marketing',
    'reviews',
    'reports',
    'settings',
  ];
  const ALL_PERMISSION_KEYS = AREAS.flatMap((a) => [`${a}.view`, `${a}.manage`]);
  const BUILT_IN_ROLE_AREAS: Record<string, string[] | '*'> = {
    SUPER_ADMIN: '*',
    ADMIN: AREAS.filter((a) => a !== 'settings'),
    CONTENT_MANAGER: ['cms'],
    MARKETING_MANAGER: ['promotions', 'loyalty', 'marketing', 'reports', 'customers'],
    SUPPORT_AGENT: ['orders', 'returns', 'customers', 'reviews'],
    WAREHOUSE_STAFF: ['inventory'],
  };
  for (const key of ALL_PERMISSION_KEYS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  for (const [roleName, areas] of Object.entries(BUILT_IN_ROLE_AREAS)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;
    const keys =
      areas === '*' ? ALL_PERMISSION_KEYS : areas.flatMap((a) => [`${a}.view`, `${a}.manage`]);
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log(
    `  ✓ ${ROLES.length} roles, ${permissionKeys.length + ALL_PERMISSION_KEYS.length} permissions`,
  );
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      firstName: 'Super',
      lastName: 'Admin',
      passwordHash: await argon2.hash(password),
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: { roleId: role.id } },
    },
  });
  console.log(`  ✓ super admin: ${email}`);
}

async function seedLocalization() {
  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, isDefault: true },
  });
  await prisma.currency.upsert({
    where: { code: 'PKR' },
    update: {},
    create: { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs', exchangeRate: 280 },
  });
  await prisma.language.upsert({
    where: { code: 'en' },
    update: {},
    create: { code: 'en', name: 'English', isDefault: true },
  });
  // Set up for later: activate it once the Urdu storefront text is added.
  await prisma.language.upsert({
    where: { code: 'ur' },
    update: {},
    create: { code: 'ur', name: 'اردو (Urdu)', isRtl: true, isActive: false },
  });
  if ((await prisma.taxRate.count()) === 0) {
    await prisma.taxRate.create({
      data: { name: 'GST', taxClass: 'standard', countryCode: 'PK', rate: 0.18, isInclusive: true },
    });
  }
  // Test gateway on by default (credentials fall back to PAYMENT_WEBHOOK_SECRET in .env).
  await prisma.paymentGateway.upsert({
    where: { code: 'mock' },
    update: {},
    create: {
      code: 'mock',
      isEnabled: true,
      isTestMode: true,
      methods: ['CARD', 'WALLET'],
      position: 0,
    },
  });
  console.log('  ✓ currencies & languages, payment gateway');
}

async function seedSettings() {
  const settings: { key: string; group: string; value: unknown }[] = [
    { key: 'store.name', group: 'general', value: 'Ecommerce' },
    { key: 'store.supportEmail', group: 'general', value: 'support@example.com' },
    { key: 'store.maintenanceMode', group: 'general', value: false },
    // IANA zone used for report day boundaries (e.g. 'UTC', 'Asia/Karachi', 'Europe/London').
    { key: 'store.timezone', group: 'general', value: 'Asia/Karachi' },
    { key: 'tax.enabled', group: 'tax', value: true },
    { key: 'tax.defaultCountry', group: 'tax', value: 'PK' },
    { key: 'store.logoUrl', group: 'general', value: '' },
    { key: 'store.phone', group: 'general', value: '' },
    { key: 'store.address', group: 'general', value: '' },
    {
      key: 'store.maintenanceMessage',
      group: 'general',
      value: "We're making some improvements and will be back shortly.",
    },
    // Customer segments (Admin → Customers)
    { key: 'customers.newDays', group: 'customers', value: 30 },
    { key: 'customers.repeatOrders', group: 'customers', value: 2 },
    { key: 'customers.highValueSpend', group: 'customers', value: 500 },
    { key: 'customers.inactiveDays', group: 'customers', value: 90 },
    { key: 'marketplace.productApprovalRequired', group: 'vendors', value: true },
    { key: 'marketplace.defaultCommissionRate', group: 'vendors', value: 10 },
    { key: 'marketplace.payoutCycle', group: 'vendors', value: 'MONTHLY' },
    { key: 'payouts.holdDays', group: 'vendors', value: 10 },
    { key: 'payouts.minimumAmount', group: 'vendors', value: 10 },
    { key: 'checkout.guestCheckout', group: 'checkout', value: true },
    { key: 'checkout.reservationMinutes', group: 'checkout', value: 15 },
    { key: 'checkout.codFee', group: 'checkout', value: 0 },
    { key: 'checkout.codMaxOrderTotal', group: 'checkout', value: 5000 },
    { key: 'payments.onlineMethods', group: 'payments', value: 'CARD,WALLET' },
    { key: 'payments.codEnabled', group: 'payments', value: true },
    { key: 'marketing.abandonedCartEnabled', group: 'marketing', value: true },
    { key: 'marketing.abandonedCartDelays', group: 'marketing', value: '1,24,72' },
    { key: 'marketing.abandonedCartCoupon', group: 'marketing', value: '' },
    { key: 'marketing.winBackEnabled', group: 'marketing', value: true },
    { key: 'marketing.winBackDays', group: 'marketing', value: 90 },
    { key: 'marketing.winBackCoupon', group: 'marketing', value: '' },
    { key: 'returns.windowDays', group: 'returns', value: 7 },
    { key: 'reviews.requireApproval', group: 'reviews', value: false },
    { key: 'questions.requireApproval', group: 'reviews', value: true },
    { key: 'shipping.flatRatePerVendor', group: 'shipping', value: 5 },
    { key: 'shipping.freeShippingAbove', group: 'shipping', value: 50 },
    { key: 'loyalty.pointsPerCurrencyUnit', group: 'loyalty', value: 1 },
    { key: 'loyalty.pointValue', group: 'loyalty', value: 0.01 },
    { key: 'loyalty.maxRedeemPercent', group: 'loyalty', value: 50 },
    { key: 'loyalty.signupBonus', group: 'loyalty', value: 100 },
    { key: 'loyalty.reviewPoints', group: 'loyalty', value: 20 },
    { key: 'loyalty.referralPoints', group: 'loyalty', value: 200 },
    { key: 'loyalty.expiryDays', group: 'loyalty', value: 365 },
    { key: 'marketing.abandonedCartDelaysHours', group: 'marketing', value: [1, 24, 72] },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, group: s.group, value: s.value as Prisma.InputJsonValue },
    });
  }

  for (const [name, minPoints] of [
    ['Silver', 0],
    ['Gold', 5000],
    ['Platinum', 20000],
  ] as const) {
    await prisma.tier.upsert({ where: { name }, update: {}, create: { name, minPoints } });
  }

  for (const handle of ['header', 'footer']) {
    await prisma.menu.upsert({ where: { handle }, update: {}, create: { handle, name: handle } });
  }
  console.log('  ✓ settings, loyalty tiers, menus');
}

/** Couriers + Pakistan zones. Idempotent: skipped when the zone / courier already exists. */
async function seedShipping() {
  const demo = await prisma.courier.upsert({
    where: { code: 'demo-courier' },
    update: {},
    create: {
      name: 'Demo Courier',
      code: 'demo-courier',
      trackingUrlTemplate: 'https://track.example.com/{tracking}',
    },
  });
  await prisma.courier.upsert({
    where: { code: 'own-delivery' },
    update: {},
    create: { name: 'Own delivery (seller)', code: 'own-delivery' },
  });

  const zones: {
    name: string;
    countries: string[];
    regions: string[];
    rates: Prisma.ShippingRateCreateWithoutZoneInput[];
  }[] = [
    {
      name: 'Karachi',
      countries: ['PK'],
      regions: ['Karachi'],
      rates: [
        {
          name: 'Same-city delivery',
          type: 'FLAT',
          price: 3,
          freeAbove: 40,
          estimatedDays: '1-2 days',
          courier: { connect: { id: demo.id } },
        },
        { name: 'Store pickup', type: 'PICKUP', price: 0, estimatedDays: 'Ready next day' },
      ],
    },
    {
      name: 'Pakistan',
      countries: ['PK'],
      regions: [],
      rates: [
        {
          name: 'Standard',
          type: 'FLAT',
          price: 5,
          freeAbove: 50,
          maxWeightGrams: 5000,
          estimatedDays: '3-5 days',
          courier: { connect: { id: demo.id } },
        },
        {
          name: 'Express',
          type: 'FLAT',
          price: 12,
          maxWeightGrams: 5000,
          codAvailable: false,
          estimatedDays: '1-2 days',
          courier: { connect: { id: demo.id } },
        },
        {
          name: 'Heavy parcel',
          type: 'WEIGHT_BASED',
          price: 15,
          minWeightGrams: 5001,
          maxWeightGrams: 30000,
          estimatedDays: '4-6 days',
          courier: { connect: { id: demo.id } },
        },
      ],
    },
  ];
  for (const z of zones) {
    if (await prisma.shippingZone.findFirst({ where: { name: z.name } })) continue;
    await prisma.shippingZone.create({
      data: {
        name: z.name,
        countries: z.countries,
        regions: z.regions,
        rates: { create: z.rates },
      },
    });
  }
  console.log('  ✓ shipping zones + couriers');
}

async function seedCategories() {
  const tree: Record<string, string[]> = {
    Electronics: ['Smartphones', 'Laptops', 'Headphones', 'Smart Watches'],
    Fashion: ['Men', 'Women', 'Kids', 'Shoes'],
    'Home & Kitchen': ['Furniture', 'Kitchen Appliances', 'Decor'],
    'Health & Beauty': ['Skincare', 'Fragrances'],
    Sports: ['Fitness Equipment', 'Outdoor'],
  };
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/&/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  let position = 0;
  for (const [rootName, children] of Object.entries(tree)) {
    const root = await prisma.category.upsert({
      where: { slug: slug(rootName) },
      update: {},
      create: { name: rootName, slug: slug(rootName), position: position++ },
    });
    for (const [i, child] of children.entries()) {
      await prisma.category.upsert({
        where: { slug: slug(child) },
        update: {},
        create: { name: child, slug: slug(child), parentId: root.id, position: i },
      });
    }
  }
  console.log(`  ✓ categories (${Object.keys(tree).length} top-level)`);
}

async function seedBrands() {
  const brands = [
    'Apple',
    'Samsung',
    'Xiaomi',
    'Sony',
    'Dell',
    'HP',
    'Lenovo',
    'Nike',
    'Adidas',
    "L'Oréal",
  ];
  const slug = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/'/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  for (const name of brands) {
    await prisma.brand.upsert({
      where: { slug: slug(name) },
      update: {},
      create: { name, slug: slug(name) },
    });
  }
  console.log(`  ✓ brands (${brands.length})`);
}

async function seedAttributes() {
  type Seed = { name: string; code: string; type: 'select' | 'color'; values: [string, string?][] };
  const attributes: Seed[] = [
    {
      name: 'Color',
      code: 'color',
      type: 'color',
      values: [
        ['Black', '#111827'],
        ['White', '#ffffff'],
        ['Gray', '#6b7280'],
        ['Red', '#dc2626'],
        ['Blue', '#2563eb'],
        ['Green', '#16a34a'],
      ],
    },
    {
      name: 'Size',
      code: 'size',
      type: 'select',
      values: [['XS'], ['S'], ['M'], ['L'], ['XL'], ['XXL']],
    },
    {
      name: 'Storage',
      code: 'storage',
      type: 'select',
      values: [['64GB'], ['128GB'], ['256GB'], ['512GB'], ['1TB']],
    },
    { name: 'RAM', code: 'ram', type: 'select', values: [['4GB'], ['8GB'], ['16GB'], ['32GB']] },
    {
      name: 'Material',
      code: 'material',
      type: 'select',
      values: [['Cotton'], ['Polyester'], ['Leather'], ['Denim']],
    },
  ];

  for (const [position, a] of attributes.entries()) {
    const attribute = await prisma.attribute.upsert({
      where: { code: a.code },
      update: {},
      create: { name: a.name, code: a.code, type: a.type, position },
    });
    for (const [i, [label, swatch]] of a.values.entries()) {
      const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await prisma.attributeValue.upsert({
        where: { attributeId_value: { attributeId: attribute.id, value } },
        update: {},
        create: { attributeId: attribute.id, value, label, swatch: swatch ?? null, position: i },
      });
    }
  }
  console.log(`  ✓ attributes (${attributes.length})`);
}

async function seedVendors() {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'VENDOR' } });
  const vendors = [
    {
      email: 'vendor@example.com',
      firstName: 'Demo',
      lastName: 'Seller',
      store: 'Demo Electronics',
      slug: 'demo-electronics',
      status: 'APPROVED' as const,
      description: 'Phones, laptops and accessories from trusted brands.',
    },
    {
      email: 'pending@example.com',
      firstName: 'Pending',
      lastName: 'Seller',
      store: 'Pending Fashion',
      slug: 'pending-fashion',
      status: 'PENDING' as const,
      description: 'Clothing and shoes for men and women.',
    },
  ];
  const passwordHash = await argon2.hash('Vendor@12345');

  for (const v of vendors) {
    const user = await prisma.user.upsert({
      where: { email: v.email },
      update: {},
      create: {
        email: v.email,
        firstName: v.firstName,
        lastName: v.lastName,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: { roleId: role.id } },
        emailPreference: { create: {} },
      },
    });
    const store = await prisma.vendor.upsert({
      where: { slug: v.slug },
      update: {},
      create: {
        ownerId: user.id,
        name: v.store,
        slug: v.slug,
        email: v.email,
        description: v.description,
        status: v.status,
        approvedAt: v.status === 'APPROVED' ? new Date() : null,
        policies:
          v.status === 'APPROVED'
            ? {
                shipping: 'Ships in 1–2 business days nationwide.',
                returns: '7-day returns on unused items.',
              }
            : undefined,
      },
    });
    // Seller commission is a CommissionRule (scope VENDOR, no category).
    if (v.status === 'APPROVED') {
      const hasRule = await prisma.commissionRule.findFirst({
        where: { vendorId: store.id, scope: 'VENDOR', categoryId: null },
      });
      if (!hasRule)
        await prisma.commissionRule.create({
          data: { scope: 'VENDOR', vendorId: store.id, rate: 10 },
        });
    }
  }
  console.log(`  ✓ vendors (${vendors.length}) — password Vendor@12345`);
}

async function seedProducts() {
  const vendor = await prisma.vendor.findUnique({ where: { slug: 'demo-electronics' } });
  if (!vendor) return;
  const currency = (await prisma.currency.findFirst({ where: { isDefault: true } }))?.code ?? 'USD';
  const category = async (slug: string) =>
    (await prisma.category.findUniqueOrThrow({ where: { slug } })).id;
  const brand = async (slug: string) =>
    (await prisma.brand.findUniqueOrThrow({ where: { slug } })).id;

  const products = [
    {
      slug: 'galaxy-s24-ultra-256gb',
      name: 'Galaxy S24 Ultra 256GB',
      category: 'smartphones',
      brand: 'samsung',
      sku: 'SAM-S24U-256',
      price: 1199.99,
      compareAt: 1299.99,
      status: 'PUBLISHED' as const,
      specs: [
        { label: 'Screen', value: '6.8" QHD+ AMOLED' },
        { label: 'Storage', value: '256 GB' },
        { label: 'Battery', value: '5000 mAh' },
      ],
    },
    {
      slug: 'iphone-15-128gb',
      name: 'iPhone 15 128GB',
      category: 'smartphones',
      brand: 'apple',
      sku: 'APL-IP15-128',
      price: 799,
      compareAt: null,
      status: 'PUBLISHED' as const,
      specs: [
        { label: 'Screen', value: '6.1" Super Retina XDR' },
        { label: 'Storage', value: '128 GB' },
      ],
    },
    {
      slug: 'dell-xps-13',
      name: 'Dell XPS 13 (Intel Core Ultra 7, 16GB)',
      category: 'laptops',
      brand: 'dell',
      sku: 'DEL-XPS13-U7-16',
      price: 1399,
      compareAt: 1499,
      status: 'PENDING_REVIEW' as const,
      specs: [
        { label: 'Processor', value: 'Intel Core Ultra 7' },
        { label: 'RAM', value: '16 GB' },
      ],
    },
    {
      slug: 'sony-wh-1000xm5',
      name: 'Sony WH-1000XM5 Wireless Headphones',
      category: 'headphones',
      brand: 'sony',
      sku: 'SNY-WH1000XM5',
      price: 349.99,
      compareAt: 399.99,
      status: 'DRAFT' as const,
      specs: [{ label: 'Battery life', value: 'Up to 30 hours' }],
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        vendorId: vendor.id,
        categoryId: await category(p.category),
        brandId: await brand(p.brand),
        name: p.name,
        slug: p.slug,
        shortDescription: `${p.name} — sold by ${vendor.name}.`,
        description: `${p.name}. Sample product created by the seed script. Replace the images and description from the seller center.`,
        specifications: p.specs,
        basePrice: p.price,
        compareAtPrice: p.compareAt,
        currency,
        status: p.status,
        publishedAt: p.status === 'PUBLISHED' ? new Date() : null,
        variants: {
          create: { sku: p.sku, price: p.price, compareAtPrice: p.compareAt, isDefault: true },
        },
      },
    });
  }
  console.log(`  ✓ products (${products.length}) for ${vendor.name}`);
}

async function seedInventory() {
  const vendor = await prisma.vendor.findUnique({ where: { slug: 'demo-electronics' } });
  if (!vendor) return;
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'DEMO-ELECTRONICS-MAIN' },
    update: {},
    create: {
      vendorId: vendor.id,
      name: 'Main warehouse',
      code: 'DEMO-ELECTRONICS-MAIN',
      address: { city: 'Lahore', country: 'Pakistan' },
    },
  });
  // In stock, low, in stock, out — so every inventory state is visible.
  const stock: Record<string, number> = {
    'SAM-S24U-256': 25,
    'APL-IP15-128': 3,
    'DEL-XPS13-U7-16': 12,
    'SNY-WH1000XM5': 0,
  };
  for (const [sku, quantity] of Object.entries(stock)) {
    const variant = await prisma.productVariant.findUnique({ where: { sku } });
    if (!variant) continue;
    const existing = await prisma.stockLevel.findUnique({
      where: { variantId_warehouseId: { variantId: variant.id, warehouseId: warehouse.id } },
    });
    if (existing) continue;
    await prisma.stockLevel.create({
      data: { variantId: variant.id, warehouseId: warehouse.id, quantity },
    });
    if (quantity > 0) {
      await prisma.stockMovement.create({
        data: {
          variantId: variant.id,
          warehouseId: warehouse.id,
          type: 'PURCHASE',
          quantity,
          note: 'Opening stock (seed)',
        },
      });
    }
  }
  console.log('  ✓ inventory (main warehouse + opening stock)');
}

/** Demo colour/storage variants so the product page shows option pickers. Runs once per product. */
async function seedVariantOptions() {
  const warehouse = await prisma.warehouse.findUnique({ where: { code: 'DEMO-ELECTRONICS-MAIN' } });
  const value = async (code: string, v: string) =>
    (
      await prisma.attributeValue.findFirstOrThrow({
        where: { value: v, attribute: { code } },
      })
    ).id;
  const plans: {
    slug: string;
    sku: string;
    colors: string[];
    storage: { v: string; extra: number }[];
  }[] = [
    {
      slug: 'iphone-15-128gb',
      sku: 'APL-IP15',
      colors: ['Black', 'Blue', 'Green'],
      storage: [
        { v: '128GB', extra: 0 },
        { v: '256GB', extra: 100 },
      ],
    },
    {
      slug: 'galaxy-s24-ultra-256gb',
      sku: 'SAM-S24U',
      colors: ['Black', 'Gray'],
      storage: [
        { v: '256GB', extra: 0 },
        { v: '512GB', extra: 120 },
      ],
    },
  ];
  for (const plan of plans) {
    const product = await prisma.product.findUnique({
      where: { slug: plan.slug },
      include: { variants: { include: { attributes: true } } },
    });
    if (!product || product.variants.some((v) => v.attributes.length > 0)) continue;
    const base = Number(product.basePrice);
    const compare = product.compareAtPrice === null ? null : Number(product.compareAtPrice);
    let first = true;
    for (const color of plan.colors) {
      for (const st of plan.storage) {
        const valueIds = [await value('color', color), await value('storage', st.v)];
        const price = base + st.extra;
        const data = {
          name: `${color} / ${st.v}`,
          price,
          compareAtPrice: compare === null ? null : compare + st.extra,
        };
        let variantId: string;
        if (first) {
          // Reuse the existing default variant (keeps its stock and any orders).
          variantId = product.variants.find((v) => v.isDefault)?.id ?? product.variants[0]!.id;
          await prisma.productVariant.update({ where: { id: variantId }, data });
          first = false;
        } else {
          const created = await prisma.productVariant.create({
            data: {
              ...data,
              productId: product.id,
              sku: `${plan.sku}-${color.toUpperCase()}-${st.v}`,
              isDefault: false,
            },
          });
          variantId = created.id;
          if (warehouse) {
            await prisma.stockLevel.create({
              data: { variantId, warehouseId: warehouse.id, quantity: 10 },
            });
          }
        }
        await prisma.productVariantAttribute.createMany({
          data: valueIds.map((attributeValueId) => ({ variantId, attributeValueId })),
          skipDuplicates: true,
        });
      }
    }
  }
  console.log('  ✓ demo colour/storage variants');
}

// ---------------------------------------------------------------- CMS (Step 18)

type SeedBlock =
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'button'; label: string; url: string };

const h = (text: string): SeedBlock => ({ type: 'heading', text, level: 2 });
const p = (text: string): SeedBlock => ({ type: 'paragraph', text });

const SEED_PAGES: { slug: string; title: string; blocks: SeedBlock[] }[] = [
  {
    slug: 'about',
    title: 'About us',
    blocks: [
      p(
        'We bring trusted sellers and shoppers together in one place, with cash on delivery and easy returns.',
      ),
      h('What we stand for'),
      p(
        'Genuine products, honest prices and fast delivery. Every seller is reviewed before they can sell.',
      ),
      { type: 'button', label: 'Start shopping', url: '/products' },
    ],
  },
  {
    slug: 'shipping-policy',
    title: 'Shipping policy',
    blocks: [
      p(
        'Each seller ships their items separately. Delivery options and prices are shown at checkout.',
      ),
      h('Delivery times'),
      p(
        'Most orders arrive in 2–5 working days. You get an email with the tracking number when your parcel ships.',
      ),
    ],
  },
  {
    slug: 'return-policy',
    title: 'Return policy',
    blocks: [
      p('You can request a return from your order page within the return window after delivery.'),
      h('Refunds'),
      p('Once the seller receives the item, your refund is sent to the original payment method.'),
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of service',
    blocks: [
      p('By using this store you agree to these terms. Replace this text with your own terms.'),
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy policy',
    blocks: [
      p(
        'We only use your data to process orders and improve the store. Replace this text with your own policy.',
      ),
    ],
  },
];

const SEED_MENUS: Record<
  'header' | 'footer',
  {
    name: string;
    items: { label: string; url: string; children?: { label: string; url: string }[] }[];
  }
> = {
  header: {
    name: 'Header menu',
    items: [
      { label: 'Shop', url: '/products' },
      { label: 'Electronics', url: '/categories/electronics' },
      { label: 'Fashion', url: '/categories/fashion' },
      { label: 'Featured', url: '/products?featured=true' },
    ],
  },
  footer: {
    name: 'Footer menu',
    items: [
      {
        label: 'Shop',
        url: '/products',
        children: [
          { label: 'All products', url: '/products' },
          { label: 'Track order', url: '/track-order' },
        ],
      },
      {
        label: 'Help',
        url: '/faq',
        children: [
          { label: 'FAQ', url: '/faq' },
          { label: 'Shipping policy', url: '/pages/shipping-policy' },
          { label: 'Return policy', url: '/pages/return-policy' },
        ],
      },
      {
        label: 'Company',
        url: '/pages/about',
        children: [
          { label: 'About', url: '/pages/about' },
          { label: 'Terms', url: '/pages/terms' },
          { label: 'Privacy', url: '/pages/privacy' },
        ],
      },
    ],
  },
};

const SEED_FAQS: { category: string; question: string; answer: string }[] = [
  {
    category: 'Orders',
    question: 'How do I track my order?',
    answer:
      'Signed-in customers see every order under My orders. Guests can use Track order with the order number and email from the confirmation email.',
  },
  {
    category: 'Orders',
    question: 'Can I cancel my order?',
    answer:
      'Yes, as long as the seller has not shipped it yet. Open the order and choose Cancel order.',
  },
  {
    category: 'Payments',
    question: 'Which payment methods can I use?',
    answer:
      'Cash on delivery, card and other online methods shown at checkout. Cash on delivery has a maximum order value.',
  },
  {
    category: 'Returns',
    question: 'How do I return an item?',
    answer:
      'Open the delivered order and choose Return items. The seller reviews the request and you are refunded once they receive the item.',
  },
];

async function seedCms() {
  for (const page of SEED_PAGES) {
    await prisma.page.upsert({
      where: { slug_locale: { slug: page.slug, locale: 'en' } },
      update: {},
      create: {
        slug: page.slug,
        locale: 'en',
        title: page.title,
        content: { blocks: page.blocks } as Prisma.InputJsonValue,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }

  for (const [handle, menu] of Object.entries(SEED_MENUS)) {
    const existing = await prisma.menu.findUnique({
      where: { handle },
      include: { _count: { select: { items: true } } },
    });
    if (existing && existing._count.items > 0) continue; // never overwrite an edited menu
    const saved = existing ?? (await prisma.menu.create({ data: { handle, name: menu.name } }));
    for (const [i, item] of menu.items.entries()) {
      const parent = await prisma.menuItem.create({
        data: { menuId: saved.id, label: item.label, url: item.url, position: i },
      });
      for (const [j, child] of (item.children ?? []).entries()) {
        await prisma.menuItem.create({
          data: {
            menuId: saved.id,
            parentId: parent.id,
            label: child.label,
            url: child.url,
            position: j,
          },
        });
      }
    }
  }

  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({
      data: SEED_FAQS.map((f, i) => ({ ...f, position: i })),
    });
  }
  console.log('  ✓ cms pages, menus, faqs');
}

async function seedBlog() {
  const news = await prisma.blogCategory.upsert({
    where: { slug: 'news' },
    update: {},
    create: { name: 'News', slug: 'news' },
  });
  const guides = await prisma.blogCategory.upsert({
    where: { slug: 'buying-guides' },
    update: {},
    create: { name: 'Buying guides', slug: 'buying-guides' },
  });
  const admin = await prisma.user.findUnique({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com' },
  });
  const posts = [
    {
      slug: 'welcome-to-our-marketplace',
      title: 'Welcome to our marketplace',
      excerpt:
        'Trusted sellers, cash on delivery and easy returns — here is how shopping with us works.',
      categoryId: news.id,
      tags: ['announcements'],
      blocks: [
        p('We built this store so you can buy from many trusted sellers in one checkout.'),
        h('How it works'),
        p(
          'Every seller is reviewed before they can sell. You pay once, and each seller ships their items separately with tracking.',
        ),
        { type: 'button', label: 'Start shopping', url: '/products' } as SeedBlock,
      ],
    },
    {
      slug: 'how-to-choose-a-smartphone',
      title: 'How to choose a smartphone in 2026',
      excerpt: 'Screen, camera, battery and storage: the five things to compare before you buy.',
      categoryId: guides.id,
      tags: ['smartphones', 'guides'],
      blocks: [
        p(
          'Phones look alike on paper. These are the specs that actually change your day-to-day experience.',
        ),
        h('Battery and charging'),
        p(
          'Look for at least a full day of use and fast charging. Reviews tell you more than the battery size.',
        ),
        h('Storage'),
        p(
          'Photos and apps fill phones fast. 256GB is a comfortable minimum if you keep a phone for several years.',
        ),
      ],
    },
  ];
  for (const post of posts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        categoryId: post.categoryId,
        tags: post.tags,
        authorId: admin?.id ?? null,
        content: { blocks: post.blocks } as Prisma.InputJsonValue,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }
  console.log('  ✓ blog categories & posts');
}

async function main() {
  console.log('Seeding database…');
  await seedRbac();
  await seedAdmin();
  await seedLocalization();
  await seedSettings();
  await seedCategories();
  await seedBrands();
  await seedAttributes();
  await seedVendors();
  await seedProducts();
  await seedInventory();
  await seedVariantOptions();
  await seedShipping();
  await seedCms();
  await seedBlog();
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
