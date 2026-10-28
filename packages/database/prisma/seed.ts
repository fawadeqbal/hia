/**
 * HIA Furniture Solutions — seed for the single-shop build.
 *
 * Creates: roles, ONE super admin (who also owns the shop), the shop itself (a single built-in store),
 * HIA categories, sample products with photos, stock, PKR shipping, COD-only
 * payments, website pages, menus and FAQs. Safe to run again (upserts; existing rows are not overwritten).
 *
 * Change SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env BEFORE the first seed.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const SHOP = {
  name: 'HIA Furniture Solutions',
  slug: 'hia-furniture',
  motto: 'Quality Products | Competitive Prices | Reliable Service',
};
const CURRENCY = 'PKR';
const WAREHOUSE_CODE = 'HIA-MAIN';
/**
 * Sample product photos are served by the storefront (apps/web/public/catalog, free Unsplash / Pexels
 * photos — see CREDITS.md there). Replace them with your own photos in Admin → Products.
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const catalogImage = (file: string) => `${SITE_URL}/catalog/${file}`;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---------------------------------------------------------------- roles

const ROLES: { name: string; description: string }[] = [
  { name: 'SUPER_ADMIN', description: 'Shop owner: full access to everything' },
  { name: 'ADMIN', description: 'Shop staff: everything except shop settings' },
  // Role of the built-in shop account (the super admin owns the shop and passes this check).
  { name: 'VENDOR', description: 'Shop account (built in)' },
  { name: 'CUSTOMER', description: 'Registered shopper' },
];

async function seedRoles() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { ...role, isSystem: true },
    });
  }
  console.log('  ✓ roles');
}

// ---------------------------------------------------------------- super admin + the shop

async function seedAdminAndShop() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      firstName: 'HIA',
      lastName: 'Admin',
      passwordHash: await argon2.hash(password),
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: { roleId: role.id } },
    },
  });

  // The one and only store. The super admin owns it, so the admin panel can use the store
  // endpoints (products, stock, order status) directly — SUPER_ADMIN passes every role check.
  const shop = await prisma.vendor.upsert({
    where: { slug: SHOP.slug },
    update: {},
    create: {
      ownerId: admin.id,
      name: SHOP.name,
      slug: SHOP.slug,
      email,
      status: 'APPROVED',
      approvedAt: new Date(),
    },
  });
  await prisma.warehouse.upsert({
    where: { code: WAREHOUSE_CODE },
    update: {},
    create: {
      vendorId: shop.id,
      name: 'Main store',
      code: WAREHOUSE_CODE,
      address: { country: 'Pakistan' },
    },
  });
  console.log(`  ✓ super admin ${email} + shop "${SHOP.name}"`);
  return shop;
}

// ---------------------------------------------------------------- currency, payments, settings

async function seedCurrencyAndPayments() {
  await prisma.currency.upsert({
    where: { code: CURRENCY },
    update: {},
    create: {
      code: CURRENCY,
      name: 'Pakistani Rupee',
      symbol: 'Rs',
      exchangeRate: 1,
      isDefault: true,
    },
  });
  // Test card gateway exists but is OFF: checkout offers Cash on Delivery only.
  // Turn online payments on later in Admin → Settings → Payments.
  await prisma.paymentGateway.upsert({
    where: { code: 'mock' },
    update: {},
    create: { code: 'mock', isEnabled: false, isTestMode: true, methods: ['CARD'], position: 0 },
  });
  console.log('  ✓ PKR currency, COD only');
}

async function seedSettings() {
  const settings: { key: string; group: string; value: unknown }[] = [
    { key: 'store.name', group: 'general', value: SHOP.name },
    { key: 'store.tagline', group: 'general', value: SHOP.motto },
    { key: 'store.supportEmail', group: 'general', value: 'info@example.com' },
    { key: 'store.phone', group: 'general', value: '' },
    { key: 'store.whatsapp', group: 'general', value: '' },
    { key: 'store.address', group: 'general', value: '' },
    { key: 'store.logoUrl', group: 'general', value: '' },
    { key: 'store.maintenanceMode', group: 'general', value: false },
    {
      key: 'store.maintenanceMessage',
      group: 'general',
      value: "We're making some improvements and will be back shortly.",
    },
    { key: 'store.timezone', group: 'general', value: 'Asia/Karachi' },
    { key: 'customers.newDays', group: 'customers', value: 30 },
    { key: 'customers.repeatOrders', group: 'customers', value: 2 },
    { key: 'customers.highValueSpend', group: 'customers', value: 50000 },
    { key: 'customers.inactiveDays', group: 'customers', value: 90 },
    { key: 'checkout.guestCheckout', group: 'checkout', value: true },
    { key: 'checkout.reservationMinutes', group: 'checkout', value: 15 },
    { key: 'checkout.codFee', group: 'checkout', value: 0 },
    { key: 'checkout.codMaxOrderTotal', group: 'checkout', value: 0 }, // 0 = no limit
    { key: 'payments.codEnabled', group: 'payments', value: true },
    { key: 'returns.windowDays', group: 'returns', value: 7 },
    { key: 'reviews.requireApproval', group: 'reviews', value: false },
    { key: 'questions.requireApproval', group: 'reviews', value: true },
    { key: 'shipping.flatRatePerVendor', group: 'shipping', value: 500 },
    { key: 'shipping.freeShippingAbove', group: 'shipping', value: 25000 },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, group: s.group, value: s.value as Prisma.InputJsonValue },
    });
  }
  for (const handle of ['header', 'footer']) {
    await prisma.menu.upsert({ where: { handle }, update: {}, create: { handle, name: handle } });
  }
  console.log('  ✓ settings');
}

/** Pakistan-wide delivery + store pickup, in PKR. Skipped when the zone already exists. */
async function seedShipping() {
  const own = await prisma.courier.upsert({
    where: { code: 'own-delivery' },
    update: {},
    create: { name: 'Own delivery', code: 'own-delivery' },
  });
  for (const [code, name] of [
    ['tcs', 'TCS'],
    ['leopards', 'Leopards Courier'],
  ] as const) {
    await prisma.courier.upsert({ where: { code }, update: {}, create: { name, code } });
  }
  if (!(await prisma.shippingZone.findFirst({ where: { name: 'Pakistan' } }))) {
    await prisma.shippingZone.create({
      data: {
        name: 'Pakistan',
        countries: ['PK'],
        regions: [],
        rates: {
          create: [
            {
              name: 'Standard delivery',
              type: 'FLAT',
              price: 500,
              freeAbove: 25000,
              estimatedDays: '2-5 working days',
              courier: { connect: { id: own.id } },
            },
            {
              name: 'Pick up from shop',
              type: 'PICKUP',
              price: 0,
              estimatedDays: 'Ready next day',
            },
          ],
        },
      },
    });
  }
  console.log('  ✓ delivery: Pakistan standard + shop pickup');
}

// ---------------------------------------------------------------- catalog

const CATEGORY_TREE: { name: string; description: string; image: string; children: string[] }[] = [
  {
    name: 'Chair Parts',
    description: 'Spare parts and accessories to repair or upgrade any office chair.',
    image: 'cat-chair-parts.jpg',
    children: [
      'Gas Lifts',
      'Wheels & Castors',
      'Chair Bases',
      'Armrests',
      'Tilt Mechanisms',
      'Chair Accessories',
    ],
  },
  {
    name: 'Office Chairs',
    description: 'Complete office chairs for executives, staff and visitors.',
    image: 'cat-office-chairs.jpg',
    children: ['Executive Chairs', 'Staff & Mesh Chairs', 'Visitor Chairs'],
  },
  {
    name: 'Office Furniture',
    description: 'Tables and furniture for offices and institutions.',
    image: 'cat-office-furniture.jpg',
    children: ['Office Tables'],
  },
  {
    name: 'General Order Supplies',
    description: 'General order supplies for offices, businesses and institutions.',
    image: 'cat-general-supplies.jpg',
    children: [],
  },
];

async function seedCategories() {
  for (const [position, root] of CATEGORY_TREE.entries()) {
    const saved = await prisma.category.upsert({
      where: { slug: slugify(root.name) },
      update: {},
      create: {
        name: root.name,
        slug: slugify(root.name),
        description: root.description,
        imageUrl: catalogImage(root.image),
        position,
      },
    });
    // Categories seeded before photos existed get the photo (an image chosen in the admin is kept).
    if (!saved.imageUrl)
      await prisma.category.update({
        where: { id: saved.id },
        data: { imageUrl: catalogImage(root.image) },
      });
    for (const [i, child] of root.children.entries()) {
      await prisma.category.upsert({
        where: { slug: slugify(child) },
        update: {},
        create: { name: child, slug: slugify(child), parentId: saved.id, position: i },
      });
    }
  }
  console.log(`  ✓ categories (${CATEGORY_TREE.length} main groups)`);
}

const ATTRIBUTES: {
  name: string;
  code: string;
  type: 'select' | 'color';
  values: [string, string?][];
}[] = [
  {
    name: 'Colour',
    code: 'color',
    type: 'color',
    values: [
      ['Black', '#111827'],
      ['Grey', '#6b7280'],
      ['Brown', '#6b3f22'],
      ['Blue', '#1d4ed8'],
      ['Chrome', '#c0c4cc'],
    ],
  },
  {
    name: 'Size',
    code: 'size',
    type: 'select',
    values: [['50 mm'], ['60 mm'], ['320 mm'], ['350 mm'], ['Standard'], ['Heavy-duty']],
  },
];

const attributeValueSlug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function seedAttributes() {
  for (const [position, a] of ATTRIBUTES.entries()) {
    const attribute = await prisma.attribute.upsert({
      where: { code: a.code },
      update: {},
      create: { name: a.name, code: a.code, type: a.type, position },
    });
    for (const [i, [label, swatch]] of a.values.entries()) {
      await prisma.attributeValue.upsert({
        where: {
          attributeId_value: { attributeId: attribute.id, value: attributeValueSlug(label) },
        },
        update: {},
        create: {
          attributeId: attribute.id,
          value: attributeValueSlug(label),
          label,
          swatch: swatch ?? null,
          position: i,
        },
      });
    }
  }
  console.log('  ✓ product options (colour, size)');
}

type SeedVariant = {
  sku: string;
  price: number;
  compareAt?: number;
  stock: number;
  options?: Record<string, string>;
};
type SeedProduct = {
  slug: string;
  name: string;
  category: string;
  /** Photos in apps/web/public/catalog (first = main photo, second = hover photo). */
  images: string[];
  short: string;
  description: string;
  specs: { label: string; value: string }[];
  featured?: boolean;
  weightGrams?: number;
  variants: SeedVariant[];
};

const PRODUCTS: SeedProduct[] = [
  {
    slug: 'heavy-duty-gas-lift-cylinder',
    name: 'Office Chair Gas Lift Cylinder',
    category: 'gas-lifts',
    images: ['gas-lift-2.jpg', 'gas-lift-1.jpg'],
    short:
      'Replacement gas lift that fits most office chairs. Fixes a chair that sinks or will not stay up.',
    description:
      'Standard-size gas lift (hydraulic cylinder) for office and computer chairs. Fits most chairs with a universal 50 mm base hole and a standard tapered top. Choose Heavy-duty for executive chairs and heavier users.',
    specs: [
      { label: 'Fits', value: 'Most office chairs (universal taper)' },
      { label: 'Stroke', value: '100 mm' },
      { label: 'Load', value: 'Standard 120 kg · Heavy-duty 150 kg' },
    ],
    featured: true,
    weightGrams: 1800,
    variants: [
      { sku: 'HIA-GL-STD', price: 2200, stock: 40, options: { size: 'Standard' } },
      {
        sku: 'HIA-GL-HD',
        price: 2800,
        compareAt: 3200,
        stock: 25,
        options: { size: 'Heavy-duty' },
      },
    ],
  },
  {
    slug: 'chair-castor-wheels-set-of-5',
    name: 'Chair Castor Wheels (Set of 5)',
    category: 'wheels-castors',
    images: ['castor-1.jpg', 'castor-2.jpg', 'castor-3.jpg'],
    short: 'Smooth-rolling twin wheels with a standard 11 mm stem. Sold as a set of five.',
    description:
      'Twin-wheel nylon castors for office chairs. Standard 11 × 22 mm grip-ring stem fits most chair bases. Choose 60 mm for a smoother roll on carpet.',
    specs: [
      { label: 'Stem', value: '11 × 22 mm grip ring' },
      { label: 'Material', value: 'Nylon' },
      { label: 'Pack', value: '5 wheels' },
    ],
    featured: true,
    weightGrams: 600,
    variants: [
      { sku: 'HIA-WH-50', price: 1500, stock: 60, options: { size: '50 mm' } },
      { sku: 'HIA-WH-60', price: 1800, stock: 45, options: { size: '60 mm' } },
    ],
  },
  {
    slug: 'pu-soft-floor-safe-castors',
    name: 'PU Soft Castor Wheels — Floor Safe (Set of 5)',
    category: 'wheels-castors',
    images: ['pu-castor-1.jpg', 'pu-castor-2.jpg'],
    short: 'Soft polyurethane wheels that protect tiles, wood and marble floors.',
    description:
      'Quiet, soft-tread polyurethane castors that will not scratch hard floors. Standard 11 mm stem.',
    specs: [
      { label: 'Stem', value: '11 × 22 mm grip ring' },
      { label: 'Tread', value: 'Soft PU' },
      { label: 'Pack', value: '5 wheels' },
    ],
    weightGrams: 700,
    variants: [{ sku: 'HIA-WH-PU60', price: 2400, stock: 30 }],
  },
  {
    slug: 'nylon-five-star-chair-base',
    name: 'Nylon 5-Star Chair Base',
    category: 'chair-bases',
    images: ['nylon-base-2.jpg', 'nylon-base-1.jpg'],
    short: 'Strong reinforced nylon base for office chairs. Takes standard wheels and gas lifts.',
    description:
      'Five-star base in glass-reinforced nylon. Standard 50 mm centre hole for the gas lift and 11 mm wheel holes. 350 mm suits full-size chairs, 320 mm suits compact chairs.',
    specs: [
      { label: 'Material', value: 'Reinforced nylon' },
      { label: 'Centre hole', value: '50 mm' },
      { label: 'Wheel holes', value: '11 mm' },
    ],
    featured: true,
    weightGrams: 2500,
    variants: [
      { sku: 'HIA-BS-N320', price: 2500, stock: 20, options: { size: '320 mm' } },
      { sku: 'HIA-BS-N350', price: 2900, stock: 18, options: { size: '350 mm' } },
    ],
  },
  {
    slug: 'chrome-metal-chair-base-350',
    name: 'Chrome Metal Chair Base 350 mm',
    category: 'chair-bases',
    images: ['chrome-base-3.jpg', 'chrome-base-2.jpg', 'chrome-base-1.jpg'],
    short: 'Polished chrome steel base for executive chairs.',
    description:
      'Heavy-gauge chrome-plated steel five-star base for executive chairs. 350 mm radius.',
    specs: [
      { label: 'Material', value: 'Chrome-plated steel' },
      { label: 'Radius', value: '350 mm' },
    ],
    weightGrams: 3500,
    variants: [{ sku: 'HIA-BS-C350', price: 4500, compareAt: 5000, stock: 10 }],
  },
  {
    slug: 'adjustable-chair-armrests-pair',
    name: 'Adjustable Chair Armrests (Pair)',
    category: 'armrests',
    images: ['arm-adjustable-1.jpg', 'arm-adjustable-2.jpg'],
    short: 'Height-adjustable armrests with soft PU pads. Sold as a pair.',
    description:
      'Replacement height-adjustable armrests with soft PU pads. Fits most chairs with a standard two-bolt arm plate.',
    specs: [
      { label: 'Adjustment', value: 'Height, 6 positions' },
      { label: 'Pad', value: 'Soft PU' },
      { label: 'Pack', value: 'Left + right' },
    ],
    featured: true,
    weightGrams: 2000,
    variants: [{ sku: 'HIA-AR-ADJ', price: 3200, stock: 15 }],
  },
  {
    slug: 'fixed-chair-armrests-pair',
    name: 'Fixed Chair Armrests (Pair)',
    category: 'armrests',
    images: ['arm-fixed-1.jpg', 'arm-fixed-2.jpg'],
    short: 'Simple, sturdy fixed armrests. Sold as a pair.',
    description: 'Fixed nylon armrests for staff and computer chairs.',
    specs: [{ label: 'Pack', value: 'Left + right' }],
    weightGrams: 1400,
    variants: [{ sku: 'HIA-AR-FIX', price: 1800, stock: 25 }],
  },
  {
    slug: 'synchro-tilt-mechanism',
    name: 'Synchro Tilt Mechanism',
    category: 'tilt-mechanisms',
    images: ['tilt-synchro-1.jpg', 'tilt-synchro-2.jpg'],
    short: 'Seat and back recline together for ergonomic chairs. Multi-position lock.',
    description:
      'Synchro tilt mechanism for executive and ergonomic chairs. Seat and back move together, with tension knob and multi-position lock.',
    specs: [
      { label: 'Type', value: 'Synchro tilt, 4-position lock' },
      { label: 'Controls', value: 'Height lever, tension knob' },
    ],
    weightGrams: 3000,
    variants: [{ sku: 'HIA-TM-SYN', price: 4800, stock: 12 }],
  },
  {
    slug: 'butterfly-tilt-mechanism',
    name: 'Butterfly Tilt Mechanism',
    category: 'tilt-mechanisms',
    images: ['tilt-butterfly-1.jpg'],
    short: 'Basic tilt mechanism for staff and computer chairs.',
    description: 'Butterfly (single-lever) mechanism for height adjustment and basic tilt.',
    specs: [{ label: 'Controls', value: 'Single height lever' }],
    weightGrams: 1500,
    variants: [{ sku: 'HIA-TM-BTF', price: 2300, stock: 20 }],
  },
  {
    slug: 'gas-lift-dust-cover',
    name: 'Gas Lift Dust Cover',
    category: 'chair-accessories',
    images: ['dust-cover-2.jpg', 'dust-cover-1.jpg'],
    short: 'Telescopic plastic cover for the gas lift. Neat look, keeps dust out.',
    description: 'Three-section telescopic cover for standard gas lifts.',
    specs: [{ label: 'Colour', value: 'Black' }],
    weightGrams: 150,
    variants: [{ sku: 'HIA-AC-DC', price: 450, stock: 80 }],
  },
  {
    slug: 'executive-high-back-office-chair',
    name: 'Executive High-Back Office Chair',
    category: 'executive-chairs',
    images: ['executive-1.jpg', 'executive-2.jpg', 'executive-3.jpg'],
    short: 'High-back executive chair with padded headrest, synchro tilt and chrome base.',
    description:
      'Comfortable high-back executive chair with thick padding, headrest, padded armrests, synchro tilt mechanism, heavy-duty gas lift and chrome base.',
    specs: [
      { label: 'Upholstery', value: 'Premium leatherette' },
      { label: 'Mechanism', value: 'Synchro tilt with lock' },
      { label: 'Base', value: 'Chrome, 350 mm' },
      { label: 'Warranty', value: '1 year on mechanism and gas lift' },
    ],
    featured: true,
    weightGrams: 18000,
    variants: [
      {
        sku: 'HIA-CH-EXE-BLK',
        price: 38000,
        compareAt: 42000,
        stock: 6,
        options: { color: 'Black' },
      },
      {
        sku: 'HIA-CH-EXE-BRN',
        price: 38000,
        compareAt: 42000,
        stock: 4,
        options: { color: 'Brown' },
      },
    ],
  },
  {
    slug: 'ergonomic-mesh-office-chair',
    name: 'Ergonomic Mesh Office Chair',
    category: 'staff-mesh-chairs',
    images: ['mesh-1.jpg', 'mesh-2.jpg', 'mesh-3.jpg', 'mesh-4.jpg'],
    short: 'Breathable mesh back with lumbar support. Ideal for long work hours.',
    description:
      'Mid-back ergonomic chair with breathable mesh, adjustable lumbar support, adjustable armrests and nylon base.',
    specs: [
      { label: 'Back', value: 'Breathable mesh, lumbar support' },
      { label: 'Arms', value: 'Height adjustable' },
      { label: 'Warranty', value: '1 year' },
    ],
    featured: true,
    weightGrams: 14000,
    variants: [
      { sku: 'HIA-CH-MSH-BLK', price: 24500, stock: 8, options: { color: 'Black' } },
      { sku: 'HIA-CH-MSH-GRY', price: 24500, stock: 5, options: { color: 'Grey' } },
    ],
  },
  {
    slug: 'visitor-chair-chrome-frame',
    name: 'Visitor Chair — Chrome Frame',
    category: 'visitor-chairs',
    images: ['visitor-1.jpg', 'visitor-2.jpg', 'visitor-3.jpg', 'visitor-4.jpg'],
    short: 'Sturdy cantilever visitor chair for reception and meeting rooms.',
    description: 'Cantilever chrome frame with padded seat and back. Stackable up to 4.',
    specs: [
      { label: 'Frame', value: 'Chrome steel' },
      { label: 'Stackable', value: 'Up to 4' },
    ],
    weightGrams: 7000,
    variants: [{ sku: 'HIA-CH-VIS', price: 9500, stock: 20 }],
  },
  {
    slug: 'office-table-4ft',
    name: 'Office Table 4 ft',
    category: 'office-tables',
    images: ['table-1.jpg', 'table-2.jpg'],
    short: 'Compact office table with side drawer unit. 4 × 2 ft.',
    description: '4 × 2 ft office table with a lockable three-drawer side unit and cable hole.',
    specs: [
      { label: 'Size', value: '4 × 2 ft, 30 in high' },
      { label: 'Material', value: 'Laminated MDF' },
    ],
    weightGrams: 40000,
    variants: [{ sku: 'HIA-TB-4FT', price: 28000, stock: 3 }],
  },
  {
    slug: 'chair-floor-mat-clear',
    name: 'Chair Floor Mat — Clear',
    category: 'general-order-supplies',
    images: ['floor-mat-1.jpg', 'floor-mat-2.jpg'],
    short: 'Clear floor protector for office chairs. Protects carpet and tiles.',
    description: 'Tough clear PVC mat, 90 × 120 cm, for rolling chairs on carpet or hard floors.',
    specs: [{ label: 'Size', value: '90 × 120 cm' }],
    weightGrams: 3000,
    variants: [{ sku: 'HIA-GS-MAT', price: 3500, stock: 15 }],
  },
];

async function seedProducts(shopId: string) {
  const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { code: WAREHOUSE_CODE } });
  const valueId = async (code: string, label: string) =>
    (
      await prisma.attributeValue.findFirstOrThrow({
        where: { value: attributeValueSlug(label), attribute: { code } },
      })
    ).id;

  let created = 0;
  let upgraded = 0;
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findUnique({
      where: { slug: p.slug },
      include: { images: true },
    });
    if (existing) {
      // Sample products seeded with the old placeholder drawings get the photos; anything else is kept.
      if (existing.images.length && existing.images.every((i) => i.url.includes('/demo/'))) {
        await prisma.productImage.deleteMany({ where: { productId: existing.id } });
        await prisma.productImage.createMany({
          data: p.images.map((file, position) => ({
            productId: existing.id,
            url: catalogImage(file),
            altText: p.name,
            position,
          })),
        });
        upgraded++;
      }
      continue; // never overwrite an edited product
    }
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.category } });
    const first = p.variants[0]!;
    const product = await prisma.product.create({
      data: {
        vendorId: shopId,
        categoryId: category.id,
        name: p.name,
        slug: p.slug,
        shortDescription: p.short,
        description: p.description,
        specifications: p.specs,
        basePrice: Math.min(...p.variants.map((v) => v.price)),
        compareAtPrice: first.compareAt ?? null,
        currency: CURRENCY,
        weightGrams: p.weightGrams ?? null,
        isFeatured: p.featured ?? false,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        images: {
          create: p.images.map((file, position) => ({
            url: catalogImage(file),
            altText: p.name,
            position,
          })),
        },
      },
    });
    for (const [i, v] of p.variants.entries()) {
      const options = Object.entries(v.options ?? {});
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          name: options.length ? options.map(([, label]) => label).join(' / ') : null,
          price: v.price,
          compareAtPrice: v.compareAt ?? null,
          isDefault: i === 0,
          position: i,
        },
      });
      for (const [code, label] of options) {
        await prisma.productVariantAttribute.create({
          data: { variantId: variant.id, attributeValueId: await valueId(code, label) },
        });
      }
      await prisma.stockLevel.create({
        data: { variantId: variant.id, warehouseId: warehouse.id, quantity: v.stock },
      });
      if (v.stock > 0) {
        await prisma.stockMovement.create({
          data: {
            variantId: variant.id,
            warehouseId: warehouse.id,
            type: 'PURCHASE',
            quantity: v.stock,
            note: 'Opening stock',
          },
        });
      }
    }
    created++;
  }
  console.log(
    `  ✓ sample products (${created} new, ${PRODUCTS.length - created} already there, ${upgraded} got photos)`,
  );
}

// ---------------------------------------------------------------- website content

type SeedBlock =
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'button'; label: string; url: string };

const h = (text: string): SeedBlock => ({ type: 'heading', text, level: 2 });
const p = (text: string): SeedBlock => ({ type: 'paragraph', text });

const SEED_PAGES: { slug: string; title: string; blocks: SeedBlock[] }[] = [
  {
    slug: 'about',
    title: 'About HIA Furniture Solutions',
    blocks: [
      p(
        'HIA Furniture Solutions is a trusted supplier of office chair spare parts, furniture, and general order supplies. We specialize in providing high-quality chair components, including gas lifts, wheels, bases, armrests, tilt mechanisms, and other accessories.',
      ),
      p(
        'We also offer complete office chairs, furniture supplies, and chair repair and maintenance solutions for individuals, businesses, offices, and institutions.',
      ),
      h('Our commitment'),
      p(
        "Our commitment is to provide quality products, competitive prices, reliable service, and customer satisfaction. We aim to meet our customers' requirements through professional service and dependable supply.",
      ),
      h('Our motto'),
      p(SHOP.motto),
      { type: 'button', label: 'Shop chair parts', url: '/categories/chair-parts' },
    ],
  },
  {
    slug: 'services',
    title: 'Our Products & Services',
    blocks: [
      h('Office Chair Parts & Accessories'),
      p(
        'Gas lifts, wheels and castors, bases, armrests, tilt mechanisms and other accessories to repair or upgrade any office chair.',
      ),
      h('Office Chairs'),
      p('Executive, staff, mesh and visitor chairs for every office and budget.'),
      h('Chair Repair & Maintenance'),
      p(
        'Is your chair sinking, wobbling or broken? We repair and service office chairs for homes, offices and institutions. Contact us with a photo of the chair and we will tell you what it needs.',
      ),
      h('Wholesale & Retail Supply'),
      p('Buy a single part or in bulk. Ask us for wholesale prices on large quantities.'),
      h('General Order Supplies'),
      p('We take general orders for offices and businesses — tell us what you need.'),
      h('Institutional & Corporate Supplies'),
      p(
        'Dependable supply for schools, universities, hospitals, government offices and companies, with quotations and invoices.',
      ),
      { type: 'button', label: 'Request a quote or repair', url: '/contact' },
    ],
  },
  {
    slug: 'shipping-policy',
    title: 'Delivery policy',
    blocks: [
      p('We deliver across Pakistan. Delivery options and prices are shown at checkout.'),
      h('Delivery times'),
      p('Most orders arrive in 2–5 working days. You can also pick up your order from our shop.'),
      h('Cash on delivery'),
      p('Pay in cash when your order arrives.'),
    ],
  },
  {
    slug: 'return-policy',
    title: 'Return policy',
    blocks: [
      p(
        'You can request a return from your order page within 7 days of delivery. Items must be unused and in their original packing.',
      ),
      h('Wrong part?'),
      p(
        'Not sure a part fits your chair? Contact us before ordering — send a photo and we will help you choose the right part.',
      ),
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of service',
    blocks: [
      p('By using this website you agree to these terms. Replace this text with your own terms.'),
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy policy',
    blocks: [
      p(
        'We only use your information to process your orders and contact you about them. Replace this text with your own policy.',
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
      { label: 'Chair Parts', url: '/categories/chair-parts' },
      { label: 'Office Chairs', url: '/categories/office-chairs' },
      { label: 'Furniture', url: '/categories/office-furniture' },
      { label: 'General Supplies', url: '/categories/general-order-supplies' },
      { label: 'Repair & Services', url: '/pages/services' },
    ],
  },
  footer: {
    name: 'Footer menu',
    items: [
      {
        label: 'Shop',
        url: '/products',
        children: [
          { label: 'Chair parts', url: '/categories/chair-parts' },
          { label: 'Office chairs', url: '/categories/office-chairs' },
          { label: 'All products', url: '/products' },
          { label: 'Track order', url: '/track-order' },
        ],
      },
      {
        label: 'Help',
        url: '/faq',
        children: [
          { label: 'Contact us', url: '/contact' },
          { label: 'FAQ', url: '/faq' },
          { label: 'Delivery policy', url: '/pages/shipping-policy' },
          { label: 'Return policy', url: '/pages/return-policy' },
        ],
      },
      {
        label: 'HIA Furniture',
        url: '/pages/about',
        children: [
          { label: 'About us', url: '/pages/about' },
          { label: 'Products & services', url: '/pages/services' },
          { label: 'Terms', url: '/pages/terms' },
          { label: 'Privacy', url: '/pages/privacy' },
        ],
      },
    ],
  },
};

const SEED_FAQS: { category: string; question: string; answer: string }[] = [
  {
    category: 'Parts',
    question: 'How do I know which part fits my chair?',
    answer:
      'Most office chairs use standard sizes (50 mm gas lift hole, 11 mm wheel stems). If you are not sure, contact us with a photo of your chair and we will tell you the right part.',
  },
  {
    category: 'Repair',
    question: 'Do you repair office chairs?',
    answer:
      'Yes. We repair and service office chairs for homes, offices and institutions — gas lifts, mechanisms, bases, wheels, arms and upholstery. Contact us for a quote.',
  },
  {
    category: 'Orders',
    question: 'Do you supply in bulk to offices and institutions?',
    answer:
      'Yes. We offer wholesale prices and institutional / corporate supply with quotations and invoices. Contact us with your list.',
  },
  {
    category: 'Payments',
    question: 'How can I pay?',
    answer: 'Cash on delivery — you pay when your order arrives.',
  },
  {
    category: 'Orders',
    question: 'How do I track my order?',
    answer:
      'Signed-in customers see every order under My orders. Guests can use Track order with the order number and email from the confirmation email.',
  },
];

async function seedCms() {
  for (const page of SEED_PAGES) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      update: {},
      create: {
        slug: page.slug,
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
    await prisma.menu.update({ where: { id: saved.id }, data: { name: menu.name } });
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
    await prisma.faq.createMany({ data: SEED_FAQS.map((f, i) => ({ ...f, position: i })) });
  }
  console.log('  ✓ website pages, menus, FAQs');
}

async function main() {
  console.log('Seeding HIA Furniture Solutions…');
  await seedRoles();
  const shop = await seedAdminAndShop();
  await seedCurrencyAndPayments();
  await seedSettings();
  await seedShipping();
  await seedCategories();
  await seedAttributes();
  await seedProducts(shop.id);
  await seedCms();
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
